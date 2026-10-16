import type { Measure } from '../models/common.ts';
import type { Exercise } from '../models/exercise.ts';
import type {
	SessionBlockInput,
	SessionDetail,
	SessionInput,
	SessionItemInput
} from '../models/session.ts';
import { countExercises, estimateSessionSeconds } from './session-plan.ts';

/**
 * The editable form of a session.
 *
 * A draft is the same tree as a `SessionInput` with a client-side `key` on every
 * node, so rows keep their identity while being reordered before anything is
 * saved. Converting back out is the only way the editor produces a payload —
 * there is no second, parallel notion of what a session is.
 */

export interface DraftItem extends SessionItemInput {
	key: string;
}

export interface DraftBlock extends Omit<SessionBlockInput, 'items'> {
	key: string;
	items: DraftItem[];
}

export interface SessionDraft {
	name: string;
	description: string;
	blocks: DraftBlock[];
}

let counter = 0;
export function draftKey(prefix = 'k'): string {
	counter += 1;
	return `${prefix}${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyItem(exerciseId: string, measure?: Measure | null): DraftItem {
	return {
		key: draftKey('i'),
		exerciseId,
		measure: measure ?? { type: 'reps', value: 10 },
		restAfterSec: 0,
		targetLoad: '',
		notes: ''
	};
}

export function emptyBlock(label = ''): DraftBlock {
	return {
		key: draftKey('b'),
		label,
		rounds: 1,
		restBetweenRoundsSec: 60,
		restAfterSec: 90,
		items: []
	};
}

export function emptyDraft(): SessionDraft {
	return { name: '', description: '', blocks: [emptyBlock()] };
}

export function draftFromSession(session: SessionDetail): SessionDraft {
	return {
		name: session.name,
		description: session.description,
		blocks: session.blocks.map((block) => ({
			key: draftKey('b'),
			label: block.label,
			rounds: block.rounds,
			restBetweenRoundsSec: block.restBetweenRoundsSec,
			restAfterSec: block.restAfterSec,
			items: block.items.map((item) => ({
				key: draftKey('i'),
				exerciseId: item.exerciseId,
				measure: item.measure,
				restAfterSec: item.restAfterSec,
				targetLoad: item.targetLoad,
				notes: item.notes
			}))
		}))
	};
}

export function draftToInput(draft: SessionDraft): SessionInput {
	return {
		name: draft.name.trim(),
		description: draft.description.trim(),
		blocks: draft.blocks.map((block) => ({
			label: block.label.trim(),
			rounds: block.rounds,
			restBetweenRoundsSec: block.restBetweenRoundsSec,
			restAfterSec: block.restAfterSec,
			items: block.items.map((item) => ({
				exerciseId: item.exerciseId,
				measure: item.measure,
				restAfterSec: item.restAfterSec,
				targetLoad: item.targetLoad.trim(),
				notes: item.notes.trim()
			}))
		}))
	};
}

/**
 * Did an edit change what is actually run — blocks, exercises, measures, rest?
 * Name and description are labels: runs from before a rename still time the
 * same session, so only the block tree counts. Both sides go through
 * `draftToInput`, so trimming and field order never register as a change.
 */
export function planChanged(before: SessionInput, after: SessionInput): boolean {
	return JSON.stringify(before.blocks) !== JSON.stringify(after.blocks);
}

/**
 * A draft rendered as a `SessionDetail`, so the live preview can run the very
 * same `buildPlan` the runner will use rather than approximating it.
 */
export function draftToPreview(
	draft: SessionDraft,
	exercises: Map<string, Exercise>,
	id = 'preview'
): SessionDetail {
	const now = new Date().toISOString();
	const blocks = draft.blocks.map((block, blockIndex) => ({
		id: block.key,
		sessionId: id,
		position: blockIndex,
		label: block.label,
		rounds: block.rounds,
		restBetweenRoundsSec: block.restBetweenRoundsSec,
		restAfterSec: block.restAfterSec,
		items: block.items.flatMap((item, itemIndex) => {
			const exercise = exercises.get(item.exerciseId);
			if (!exercise) return [];
			return [
				{
					id: item.key,
					blockId: block.key,
					position: itemIndex,
					exerciseId: item.exerciseId,
					measure: item.measure,
					restAfterSec: item.restAfterSec,
					targetLoad: item.targetLoad,
					notes: item.notes,
					exercise
				}
			];
		})
	}));

	return {
		id,
		name: draft.name,
		description: draft.description,
		blockCount: blocks.length,
		exerciseCount: countExercises(blocks),
		estimatedDurationSec: estimateSessionSeconds(blocks),
		createdAt: now,
		updatedAt: now,
		blocks
	};
}

/** Local validation, so the editor can point at the problem before a round trip. */
export function validateDraft(draft: SessionDraft): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!draft.name.trim()) errors.name = 'A name is required';
	if (draft.blocks.length === 0) errors.blocks = 'Add at least one block';
	draft.blocks.forEach((block, index) => {
		if (block.items.length === 0) {
			errors[`blocks.${index}`] = 'This block needs at least one exercise';
		}
	});
	return errors;
}

/** Moves an element, returning a new array. Used for both blocks and items. */
export function move<T>(list: T[], from: number, to: number): T[] {
	if (to < 0 || to >= list.length || from === to) return list;
	const next = [...list];
	const [moved] = next.splice(from, 1);
	if (moved !== undefined) next.splice(to, 0, moved);
	return next;
}
