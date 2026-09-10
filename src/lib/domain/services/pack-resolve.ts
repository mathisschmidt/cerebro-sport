import type { IsoDate } from '../models/common.ts';
import type { ExerciseInput } from '../models/exercise.ts';
import type { Pack, PackRoutine, PackSession, ImportOptions } from '../models/pack.ts';
import type { SessionInput } from '../models/session.ts';
import { describeRecurrence } from '../models/routine.ts';
import { countExercises, estimateSessionSeconds } from './session-plan.ts';
import type { PackIssue } from './pack-parse.ts';
import { todayIso } from './date.ts';

/**
 * Turns a validated pack plus the current library into a concrete plan of what
 * importing it would do.
 *
 * Pure, so the Coach page renders the preview from it directly and the server
 * re-runs the very same function against live data before writing. One
 * resolver, two callers — the preview can never promise something the import
 * does not do.
 */

export interface ResolvedExercise {
	name: string;
	/** `reuse` matched the library, `create` was declared, `stub` was only referenced. */
	status: 'reuse' | 'create' | 'stub';
	input: ExerciseInput;
	existingId: string | null;
	/** Sessions in this pack that use it. */
	usedBy: string[];
}

export interface ResolvedSession {
	/** The name it will be saved under, after any collision rename. */
	name: string;
	originalName: string;
	renamed: boolean;
	description: string;
	blockCount: number;
	exerciseCount: number;
	estimatedDurationSec: number;
	source: PackSession;
}

export interface ResolvedRoutine {
	name: string;
	sessionName: string;
	/** Where the target session comes from — `missing` is an error. */
	target: 'pack' | 'library' | 'missing';
	recurrenceLabel: string;
	startDate: IsoDate;
	endDate: IsoDate | null;
	timeOfDay: string | null;
	source: PackRoutine;
}

export interface PackPlan {
	summary: string;
	exercises: ResolvedExercise[];
	sessions: ResolvedSession[];
	routines: ResolvedRoutine[];
	issues: PackIssue[];
	/** True when nothing blocks an import. Warnings do not block. */
	importable: boolean;
}

export interface ResolveContext {
	existingExercises: Array<{ id: string; name: string }>;
	existingSessions: Array<{ id: string; name: string }>;
	today?: IsoDate;
	options?: Partial<ImportOptions>;
}

const key = (name: string) => name.trim().toLowerCase();

/** `Circuit`, `Circuit (2)`, `Circuit (3)` — first name not already taken. */
function uniqueName(desired: string, taken: Set<string>): string {
	if (!taken.has(key(desired))) return desired;
	for (let suffix = 2; suffix < 100; suffix++) {
		const candidate = `${desired} (${suffix})`;
		if (!taken.has(key(candidate))) return candidate;
	}
	return `${desired} (${Date.now()})`;
}

function stubExercise(name: string): ExerciseInput {
	return {
		name,
		description: '',
		instructions: '',
		category: 'other',
		tags: [],
		defaultMeasure: null
	};
}

export function resolvePack(pack: Pack, context: ResolveContext): PackPlan {
	const today = context.today ?? todayIso();
	const skipSessions = new Set((context.options?.skipSessions ?? []).map(key));
	const skipRoutines = new Set((context.options?.skipRoutines ?? []).map(key));
	const includeRoutines = context.options?.includeRoutines ?? true;

	const issues: PackIssue[] = [];
	const libraryByName = new Map(context.existingExercises.map((e) => [key(e.name), e]));
	const declaredByName = new Map(pack.exercises.map((e) => [key(e.name), e]));

	// --- Sessions, with collision renaming --------------------------------
	const takenSessionNames = new Set(context.existingSessions.map((s) => key(s.name)));
	const sessions: ResolvedSession[] = [];
	/** Original pack name → final saved name, so routines follow a rename. */
	const sessionNameMap = new Map<string, string>();

	for (const source of pack.sessions) {
		if (skipSessions.has(key(source.name))) continue;

		const name = uniqueName(source.name, takenSessionNames);
		takenSessionNames.add(key(name));
		sessionNameMap.set(key(source.name), name);

		sessions.push({
			name,
			originalName: source.name,
			renamed: name !== source.name,
			description: source.description,
			blockCount: source.blocks.length,
			exerciseCount: countExercises(source.blocks),
			estimatedDurationSec: estimateSessionSeconds(source.blocks),
			source
		});
	}

	// --- Exercises: everything the kept sessions actually reference --------
	// Keyed case-insensitively, but the first spelling seen is kept: an exercise
	// that only ever appears in an item must still be created as "Kettlebell
	// swing", not "kettlebell swing".
	const used = new Map<string, { spelling: string; usedBy: string[] }>();
	for (const session of sessions) {
		for (const block of session.source.blocks) {
			for (const item of block.items) {
				const entry = used.get(key(item.exercise));
				if (entry) entry.usedBy.push(session.name);
				else used.set(key(item.exercise), { spelling: item.exercise, usedBy: [session.name] });
			}
		}
	}

	const exercises: ResolvedExercise[] = [];
	const seen = new Set<string>();

	const addExercise = (name: string, usedBy: string[]) => {
		const lookup = key(name);
		if (seen.has(lookup)) return;
		seen.add(lookup);

		const existing = libraryByName.get(lookup);
		if (existing) {
			exercises.push({
				name: existing.name,
				status: 'reuse',
				input: stubExercise(existing.name),
				existingId: existing.id,
				usedBy
			});
			return;
		}

		const declared = declaredByName.get(lookup);
		if (declared) {
			exercises.push({ name: declared.name, status: 'create', input: declared, existingId: null, usedBy });
			return;
		}

		// Referenced but never declared: importable, but worth flagging — it will
		// arrive with no description or instructions to read mid-session.
		issues.push({
			level: 'warning',
			path: `sessions.*.blocks.*.items`,
			message: `"${name}" is used by a session but not described in "exercises". It will be created with an empty description.`
		});
		exercises.push({ name, status: 'stub', input: stubExercise(name), existingId: null, usedBy });
	};

	for (const [lookup, entry] of used) {
		// Prefer the library's spelling, then the pack's declaration, then how the
		// item wrote it — in that order, so existing names never get shadowed.
		const declared = declaredByName.get(lookup);
		const existing = libraryByName.get(lookup);
		addExercise(existing?.name ?? declared?.name ?? entry.spelling, entry.usedBy);
	}

	// Declared exercises no session uses are still worth importing on their own.
	for (const declared of pack.exercises) {
		addExercise(declared.name, []);
	}

	// --- Routines ---------------------------------------------------------
	const routines: ResolvedRoutine[] = [];
	if (includeRoutines) {
		const librarySessionNames = new Set(context.existingSessions.map((s) => key(s.name)));

		for (const source of pack.routines) {
			if (skipRoutines.has(key(source.name || source.session))) continue;

			const mapped = sessionNameMap.get(key(source.session));
			const target: ResolvedRoutine['target'] = mapped
				? 'pack'
				: librarySessionNames.has(key(source.session))
					? 'library'
					: 'missing';

			if (target === 'missing') {
				issues.push({
					level: 'error',
					path: 'routines',
					message: `Routine "${source.name || source.session}" points at a session called "${source.session}", which is neither in this pack nor in your library.`
				});
			}

			routines.push({
				name: source.name || mapped || source.session,
				sessionName: mapped ?? source.session,
				target,
				recurrenceLabel: describeRecurrence(source.recurrence),
				startDate: source.startDate ?? today,
				endDate: source.endDate,
				timeOfDay: source.timeOfDay,
				source
			});
		}
	}

	if (sessions.length === 0 && exercises.filter((e) => e.status !== 'reuse').length === 0) {
		issues.push({
			level: 'warning',
			path: '(root)',
			message: 'Nothing new to import — every session was skipped and every exercise already exists.'
		});
	}

	return {
		summary: pack.summary,
		exercises,
		sessions,
		routines,
		issues,
		importable: !issues.some((issue) => issue.level === 'error')
	};
}

/**
 * A resolved session as a `SessionInput`, once exercise ids are known.
 * The importer supplies the map after creating whatever was missing.
 */
export function toSessionInput(
	session: ResolvedSession,
	exerciseIdByName: Map<string, string>
): SessionInput {
	return {
		name: session.name,
		description: session.description,
		blocks: session.source.blocks.map((block) => ({
			label: block.label,
			rounds: block.rounds,
			restBetweenRoundsSec: block.restBetweenRoundsSec,
			restAfterSec: block.restAfterSec,
			items: block.items.map((item) => {
				const exerciseId = exerciseIdByName.get(key(item.exercise));
				if (!exerciseId) {
					throw new Error(`Unresolved exercise "${item.exercise}" in session "${session.name}"`);
				}
				return {
					exerciseId,
					measure: item.measure,
					restAfterSec: item.restAfterSec,
					targetLoad: item.targetLoad,
					notes: item.notes
				};
			})
		}))
	};
}

export const packKey = key;
