import { z } from 'zod';
import {
	idSchema,
	isoDateSchema,
	isoDateTimeSchema,
	measureSchema,
	timestampsSchema
} from './common.ts';
import { planStepKindSchema, sessionPlanSchema } from './plan.ts';

/**
 * A workout is one execution of a session, and the only source of metrics.
 * Step logs are written as they happen so an interrupted session can be resumed
 * or salvaged instead of lost.
 */

export const workoutStatusSchema = z.enum(['in_progress', 'completed', 'abandoned']);
export type WorkoutStatus = z.infer<typeof workoutStatusSchema>;

/** Body for starting a workout. */
export const workoutStartSchema = z.object({
	sessionId: idSchema,
	/** Set when the workout was started from a scheduled occurrence. */
	routineId: idSchema.nullable().default(null),
	occurrenceDate: isoDateSchema.nullable().default(null)
});
export type WorkoutStart = z.infer<typeof workoutStartSchema>;

/** One finished step, reported by the runner the moment it ends. */
export const workoutStepLogInputSchema = z.object({
	stepIndex: z.number().int().min(0),
	stepKey: z.string().min(1),
	kind: planStepKindSchema,
	blockId: idSchema,
	blockIndex: z.number().int().min(0),
	itemId: idSchema.nullable().default(null),
	itemIndex: z.number().int().min(0).nullable().default(null),
	roundIndex: z.number().int().min(1),
	exerciseId: idSchema.nullable().default(null),
	exerciseName: z.string().default(''),
	plannedMeasure: measureSchema.nullable().default(null),
	plannedRestSec: z.number().int().min(0).nullable().default(null),
	/** What was actually achieved: reps done, seconds held, metres covered. */
	actualValue: z.number().min(0).nullable().default(null),
	/** Wall-clock time the athlete spent on this step. */
	durationMs: z.number().int().min(0),
	skipped: z.boolean().default(false),
	startedAt: isoDateTimeSchema,
	completedAt: isoDateTimeSchema
});
export type WorkoutStepLogInput = z.infer<typeof workoutStepLogInputSchema>;

export const workoutStepLogSchema = workoutStepLogInputSchema.extend({
	id: idSchema,
	workoutId: idSchema
});
export type WorkoutStepLog = z.infer<typeof workoutStepLogSchema>;

/** Body for closing a workout out. */
export const workoutFinishSchema = z.object({
	status: z.enum(['completed', 'abandoned']).default('completed'),
	notes: z.string().trim().max(2000).default('')
});
export type WorkoutFinish = z.infer<typeof workoutFinishSchema>;

export const workoutSchema = z.object({
	id: idSchema,
	sessionId: idSchema,
	sessionName: z.string(),
	routineId: idSchema.nullable(),
	occurrenceDate: isoDateSchema.nullable(),
	status: workoutStatusSchema,
	startedAt: isoDateTimeSchema,
	completedAt: isoDateTimeSchema.nullable(),
	/**
	 * Measured time in the session: `activeMs + restMs`.
	 *
	 * Deliberately not the wall clock from start to finish — a phone left locked
	 * mid-session would otherwise report an hour of "training". Paused time is
	 * excluded for the same reason, which is what makes runs comparable.
	 */
	totalMs: z.number().int().min(0),
	/** Time inside exercise steps. */
	activeMs: z.number().int().min(0),
	/** Time inside rest steps. */
	restMs: z.number().int().min(0),
	completedStepCount: z.number().int().min(0),
	plannedStepCount: z.number().int().min(0),
	notes: z.string(),
	/** Frozen copy of the plan as it was on the day. */
	plan: sessionPlanSchema,
	...timestampsSchema.shape
});
export type Workout = z.infer<typeof workoutSchema>;

export const workoutDetailSchema = workoutSchema.extend({
	steps: z.array(workoutStepLogSchema)
});
export type WorkoutDetail = z.infer<typeof workoutDetailSchema>;

export const workoutQuerySchema = z.object({
	sessionId: idSchema.optional(),
	status: workoutStatusSchema.optional(),
	from: isoDateSchema.optional(),
	to: isoDateSchema.optional(),
	limit: z.coerce.number().int().min(1).max(500).default(100),
	offset: z.coerce.number().int().min(0).default(0)
});
export type WorkoutQuery = z.infer<typeof workoutQuerySchema>;
