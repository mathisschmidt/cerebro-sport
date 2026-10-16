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
 * Step logs are written as they happen, so leaving mid-session keeps what was
 * done. A run is never resumed: leaving it, however it happens, ends it.
 */

/**
 * `abandoned` means left before the last step and kept: the athlete chose to
 * save what they had done. Leaving and discarding deletes the workout instead.
 */
export const workoutStatusSchema = z.enum(['in_progress', 'completed', 'abandoned']);
export type WorkoutStatus = z.infer<typeof workoutStatusSchema>;

type Counted = Pick<Workout, 'status' | 'completedStepCount' | 'plannedStepCount'>;

/**
 * Does this workout feed the metrics? A finished run always does; one left early
 * does when at least one step was actually done.
 */
export function isRecorded(workout: Pick<Workout, 'status' | 'completedStepCount'>): boolean {
	return (
		workout.status === 'completed' ||
		(workout.status === 'abandoned' && workout.completedStepCount > 0)
	);
}

/** Share of the planned steps not done, 0–1 — skipped, or never reached. */
export function missedShare(workout: Pick<Workout, 'completedStepCount' | 'plannedStepCount'>): number {
	if (workout.plannedStepCount === 0) return 0;
	return Math.max(0, 1 - workout.completedStepCount / workout.plannedStepCount);
}

/**
 * How a run went, on one scale used everywhere a run is shown:
 *  - `complete`     every step done
 *  - `unfinished`   up to 30% missed
 *  - `skipped_some` more than 30% missed
 *  - `ended_early`  more than half missed
 */
export type WorkoutOutcome = 'complete' | 'unfinished' | 'skipped_some' | 'ended_early';

export const WORKOUT_OUTCOME_LABEL: Record<WorkoutOutcome, string> = {
	complete: 'Completed',
	unfinished: 'Not finished',
	skipped_some: 'Skipped a few',
	ended_early: 'Ended early'
};

export function workoutOutcome(workout: Counted): WorkoutOutcome {
	const missed = missedShare(workout);
	if (workout.status === 'completed' && missed === 0) return 'complete';
	if (missed > 0.5) return 'ended_early';
	if (missed > 0.3) return 'skipped_some';
	return 'unfinished';
}

/**
 * Only a run taken to the end with nothing skipped says anything about how long
 * the session takes, so only those feed a session's duration stats and trend.
 */
export function countsInSessionStats(workout: Counted): boolean {
	return workoutOutcome(workout) === 'complete';
}

/** Most steps a recorded plan may carry — far past any real session. */
const MAX_PLAN_STEPS = 5000;

/**
 * Body for starting a workout.
 *
 * Runs are local-first: the phone creates the workout, possibly offline, and
 * replays the start later. It then sends its own `id`, so a replayed start is
 * recognised rather than duplicated, the `startedAt` of the real start, and the
 * `plan` it actually ran. The plan is a record of what was done, stored as-is —
 * not an instruction for the server to apply to the library.
 */
export const workoutStartSchema = z.object({
	sessionId: idSchema,
	/** Set when the workout was started from a scheduled occurrence. */
	routineId: idSchema.nullable().default(null),
	occurrenceDate: isoDateSchema.nullable().default(null),
	id: idSchema.optional(),
	startedAt: isoDateTimeSchema.optional(),
	plan: sessionPlanSchema
		.refine((plan) => plan.steps.length > 0 && plan.steps.length <= MAX_PLAN_STEPS, {
			message: `A plan has between 1 and ${MAX_PLAN_STEPS} steps`
		})
		.optional()
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
	/** Time on this step with any pause taken out. */
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
	notes: z.string().trim().max(2000).default(''),
	/** When the run really ended, from the phone; a run synced later keeps it. */
	completedAt: isoDateTimeSchema.optional()
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
	 * Training time: every step's time summed, rests included, pauses excluded.
	 * A pause means the athlete stopped training — an interruption, not part of
	 * the session — so it never counts. Measured on the phone, per step.
	 */
	totalMs: z.number().int().min(0),
	/** Steps done, not skipped. Against `plannedStepCount`, this is the outcome. */
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
