import type {
	Workout,
	WorkoutDetail,
	WorkoutFinish,
	WorkoutQuery,
	WorkoutStart,
	WorkoutStepLog,
	WorkoutStepLogInput
} from '$domain/models/workout.ts';
import { workoutRepository } from '../repositories/workout.repository.ts';
import { routineRepository } from '../repositories/routine.repository.ts';
import { sessionService } from './session.service.ts';
import { badRequest, notFound } from '../http/errors.ts';

/**
 * Running a session.
 *
 * A workout freezes the plan it started from, so editing the session afterwards
 * never rewrites what was actually done. Steps are logged as they finish rather
 * than in one batch at the end, which is what makes an interrupted session
 * resumable instead of lost.
 */
export const workoutService = {
	start(userId: string, input: WorkoutStart): WorkoutDetail {
		const session = sessionService.get(userId, input.sessionId);
		const plan = sessionService.plan(userId, input.sessionId);
		if (plan.steps.length === 0) {
			throw badRequest('This session has no steps to run');
		}

		// Only one workout can be in flight; picking up a new one closes the old.
		const active = workoutRepository.findActive(userId);
		if (active) {
			workoutRepository.finish(userId, active.id, { status: 'abandoned', notes: active.notes });
		}

		const workout = workoutRepository.create({
			userId,
			sessionId: session.id,
			sessionName: session.name,
			routineId: input.routineId,
			occurrenceDate: input.occurrenceDate,
			plan
		});

		return { ...workout, steps: [] };
	},

	get(userId: string, id: string): WorkoutDetail {
		const workout = workoutRepository.findDetail(userId, id);
		if (!workout) throw notFound('Workout not found');
		return workout;
	},

	/** The workout to offer as "resume", if any. */
	active(userId: string): Workout | null {
		return workoutRepository.findActive(userId);
	},

	history(userId: string, query: WorkoutQuery): Workout[] {
		return workoutRepository.list(userId, query);
	},

	logStep(userId: string, workoutId: string, input: WorkoutStepLogInput): WorkoutStepLog {
		const workout = workoutRepository.findById(userId, workoutId);
		if (!workout) throw notFound('Workout not found');
		if (workout.status !== 'in_progress') {
			throw badRequest('This workout is already finished');
		}
		if (input.stepIndex >= workout.plan.steps.length) {
			throw badRequest('That step is not part of this workout');
		}
		return workoutRepository.upsertStep(workoutId, input);
	},

	finish(userId: string, id: string, input: WorkoutFinish): WorkoutDetail {
		const existing = workoutRepository.findById(userId, id);
		if (!existing) throw notFound('Workout not found');

		const workout = workoutRepository.finish(userId, id, {
			status: input.status,
			notes: input.notes
		});
		if (!workout) throw notFound('Workout not found');

		// Finishing a scheduled workout ticks its occurrence off the calendar.
		if (workout.routineId && workout.occurrenceDate && input.status === 'completed') {
			routineRepository.resolveOccurrence({
				routineId: workout.routineId,
				date: workout.occurrenceDate,
				status: 'completed',
				workoutId: workout.id
			});
		}

		return this.get(userId, id);
	},

	remove(userId: string, id: string): void {
		const workout = workoutRepository.findById(userId, id);
		if (!workout) throw notFound('Workout not found');

		// Release the calendar tick this workout was holding.
		if (workout.routineId && workout.occurrenceDate) {
			routineRepository.resolveOccurrence({
				routineId: workout.routineId,
				date: workout.occurrenceDate,
				status: 'pending',
				workoutId: null
			});
		}
		workoutRepository.remove(userId, id);
	}
};
