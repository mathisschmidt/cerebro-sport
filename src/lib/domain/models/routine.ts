import { z } from 'zod';
import {
	idSchema,
	isoDateSchema,
	isoDateTimeSchema,
	timeOfDaySchema,
	timestampsSchema
} from './common.ts';

/**
 * A routine schedules a session on a repeating rule, the way a repeating task
 * works in a task app. Occurrences are never materialised in the database:
 * they are computed from the rule on demand, and only the *deviations*
 * (completed / skipped) are stored. That keeps an infinite schedule finite.
 */

export const weekdaySchema = z.number().int().min(0).max(6); // 0 = Sunday
export type Weekday = z.infer<typeof weekdaySchema>;

export const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const recurrenceSchema = z.discriminatedUnion('type', [
	/** Fires a single time, on the routine's start date. */
	z.object({ type: z.literal('once') }),
	/** Every `interval` days from the start date. */
	z.object({ type: z.literal('daily'), interval: z.number().int().min(1).max(365).default(1) }),
	/** On the chosen weekdays, every `interval` weeks. */
	z.object({
		type: z.literal('weekly'),
		interval: z.number().int().min(1).max(52).default(1),
		weekdays: z.array(weekdaySchema).min(1, 'Pick at least one day')
	}),
	/** On a day of the month, every `interval` months. */
	z.object({
		type: z.literal('monthly'),
		interval: z.number().int().min(1).max(24).default(1),
		dayOfMonth: z.number().int().min(1).max(31)
	})
]);
export type Recurrence = z.infer<typeof recurrenceSchema>;
export type RecurrenceType = Recurrence['type'];

export const routineInputSchema = z.object({
	/** Defaults to the session name when left blank. */
	name: z.string().trim().max(80).default(''),
	sessionId: idSchema,
	recurrence: recurrenceSchema,
	startDate: isoDateSchema,
	endDate: isoDateSchema.nullable().default(null),
	/** Purely informative — it orders the day, it does not notify. */
	timeOfDay: timeOfDaySchema.nullable().default(null),
	active: z.boolean().default(true)
});
export type RoutineInput = z.infer<typeof routineInputSchema>;

export const routinePatchSchema = routineInputSchema.partial();
export type RoutinePatch = z.infer<typeof routinePatchSchema>;

export const routineSchema = routineInputSchema.extend({
	id: idSchema,
	...timestampsSchema.shape
});
export type Routine = z.infer<typeof routineSchema>;

/** Routine plus the session it points at, for lists and the day view. */
export const routineDetailSchema = routineSchema.extend({
	sessionName: z.string(),
	estimatedDurationSec: z.number().int().min(0)
});
export type RoutineDetail = z.infer<typeof routineDetailSchema>;

export const occurrenceStatusSchema = z.enum(['pending', 'completed', 'skipped']);
export type OccurrenceStatus = z.infer<typeof occurrenceStatusSchema>;

/** One computed hit of a routine's rule on a given day. */
export const routineOccurrenceSchema = z.object({
	routineId: idSchema,
	routineName: z.string(),
	sessionId: idSchema,
	sessionName: z.string(),
	date: isoDateSchema,
	timeOfDay: timeOfDaySchema.nullable(),
	estimatedDurationSec: z.number().int().min(0),
	status: occurrenceStatusSchema,
	workoutId: idSchema.nullable(),
	resolvedAt: isoDateTimeSchema.nullable()
});
export type RoutineOccurrence = z.infer<typeof routineOccurrenceSchema>;

/** Body for marking an occurrence done or skipped without running it. */
export const occurrenceResolutionSchema = z.object({
	routineId: idSchema,
	date: isoDateSchema,
	status: occurrenceStatusSchema,
	workoutId: idSchema.nullable().default(null)
});
export type OccurrenceResolution = z.infer<typeof occurrenceResolutionSchema>;

export function describeRecurrence(recurrence: Recurrence): string {
	switch (recurrence.type) {
		case 'once':
			return 'Once';
		case 'daily':
			return recurrence.interval === 1 ? 'Every day' : `Every ${recurrence.interval} days`;
		case 'weekly': {
			const days = [...recurrence.weekdays]
				.sort((a, b) => a - b)
				.map((d) => WEEKDAY_LABEL[d])
				.join(', ');
			return recurrence.interval === 1
				? `Weekly on ${days}`
				: `Every ${recurrence.interval} weeks on ${days}`;
		}
		case 'monthly':
			return recurrence.interval === 1
				? `Monthly on day ${recurrence.dayOfMonth}`
				: `Every ${recurrence.interval} months on day ${recurrence.dayOfMonth}`;
	}
}
