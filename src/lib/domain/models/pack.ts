import { z } from 'zod';
import { exerciseInputSchema } from './exercise.ts';
import { isoDateSchema, timeOfDaySchema } from './common.ts';
import { recurrenceSchema } from './routine.ts';
import {
	sessionBlockInputSchema,
	sessionInputSchema,
	sessionItemInputSchema
} from './session.ts';

/**
 * The training pack — the interchange format the Coach page asks an LLM to
 * produce and imports back.
 *
 * Every shape here is the corresponding domain input schema with one field
 * swapped: items reference an exercise by **name** rather than by id, because
 * whatever writes the file has no access to this database. All the real rules
 * (lengths, ranges, defaults) come from the domain schemas by derivation, so
 * the format cannot drift from what the app accepts.
 *
 * JSON rather than YAML on purpose: it needs no parser dependency, maps 1:1
 * onto zod, and has no indentation failure mode — which matters when the file
 * is produced by a model and pasted through a clipboard.
 */

export const PACK_FORMAT = 'cerebro-sport.training-pack';
export const PACK_VERSION = 1;

/** An exercise name as written in a pack. Resolution is case-insensitive. */
export const exerciseRefSchema = z.string().trim().min(1, 'An exercise name is required').max(80);

export const packItemSchema = sessionItemInputSchema
	.omit({ exerciseId: true })
	.extend({ exercise: exerciseRefSchema });
export type PackItem = z.infer<typeof packItemSchema>;

export const packBlockSchema = sessionBlockInputSchema
	.omit({ items: true })
	.extend({ items: z.array(packItemSchema).min(1, 'A block needs at least one exercise') });
export type PackBlock = z.infer<typeof packBlockSchema>;

export const packSessionSchema = sessionInputSchema
	.omit({ blocks: true })
	.extend({ blocks: z.array(packBlockSchema).min(1, 'A session needs at least one block') });
export type PackSession = z.infer<typeof packSessionSchema>;

/** Weekday names are far likelier than 0–6 indexes to come back correct. */
const WEEKDAY_ALIASES: Record<string, number> = {
	sun: 0, sunday: 0,
	mon: 1, monday: 1,
	tue: 2, tues: 2, tuesday: 2,
	wed: 3, weds: 3, wednesday: 3,
	thu: 4, thur: 4, thurs: 4, thursday: 4,
	fri: 5, friday: 5,
	sat: 6, saturday: 6
};

export const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Normalises the loose spellings a model reaches for — `"Mon"`, `"monday"`,
 * `"WEEKLY"` — into the exact shape `recurrenceSchema` expects, then hands over
 * to it. Being generous here costs one function and saves a round trip.
 */
function normaliseRecurrence(raw: unknown): unknown {
	if (typeof raw !== 'object' || raw === null) return raw;
	const value = { ...(raw as Record<string, unknown>) };

	if (typeof value.type === 'string') value.type = value.type.trim().toLowerCase();

	if (Array.isArray(value.weekdays)) {
		value.weekdays = value.weekdays.map((day) => {
			if (typeof day === 'number') return day;
			if (typeof day !== 'string') return day;
			const alias = WEEKDAY_ALIASES[day.trim().toLowerCase()];
			return alias ?? day;
		});
	}

	return value;
}

export const packRecurrenceSchema = z.preprocess(normaliseRecurrence, recurrenceSchema);

export const packRoutineSchema = z.object({
	name: z.string().trim().max(80).default(''),
	/** Name of a session — either one in this pack or one already in the library. */
	session: z.string().trim().min(1, 'A session name is required').max(80),
	recurrence: packRecurrenceSchema,
	/** Defaults to the day of the import. */
	startDate: isoDateSchema.optional(),
	endDate: isoDateSchema.nullable().default(null),
	timeOfDay: timeOfDaySchema.nullable().default(null)
});
export type PackRoutine = z.infer<typeof packRoutineSchema>;

export const packSchema = z
	.object({
		/** Both optional so a model that drops them still imports; checked if present. */
		format: z.literal(PACK_FORMAT).optional(),
		version: z.literal(PACK_VERSION).optional(),
		/** Free-text note from whatever produced the pack. Shown in the preview. */
		summary: z.string().trim().max(1000).default(''),
		exercises: z.array(exerciseInputSchema).max(200).default([]),
		sessions: z.array(packSessionSchema).max(50).default([]),
		routines: z.array(packRoutineSchema).max(50).default([])
	})
	.refine((pack) => pack.sessions.length > 0 || pack.exercises.length > 0, {
		message: 'A pack must contain at least one session or exercise',
		path: ['sessions']
	});
export type Pack = z.infer<typeof packSchema>;

/** What the importer was asked to do with a pack, per entry. */
export const importOptionsSchema = z.object({
	/** Session names to skip; everything else in the pack is imported. */
	skipSessions: z.array(z.string()).default([]),
	skipRoutines: z.array(z.string()).default([]),
	/** Import the routines section at all. */
	includeRoutines: z.boolean().default(true)
});
export type ImportOptions = z.infer<typeof importOptionsSchema>;

export const importRequestSchema = z.object({
	pack: packSchema,
	options: importOptionsSchema.default({ skipSessions: [], skipRoutines: [], includeRoutines: true })
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

export interface ImportResult {
	exercisesCreated: number;
	exercisesReused: number;
	sessionsCreated: string[];
	routinesCreated: number;
	skipped: string[];
	/** Names that had to be renamed to avoid colliding with the existing library. */
	renamed: Array<{ from: string; to: string }>;
}
