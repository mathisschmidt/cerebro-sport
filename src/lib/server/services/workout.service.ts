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
	start(input: WorkoutStart): WorkoutDetail {
		const session = sessionService.get(input.sessionId);
		const plan = sessionService.plan(input.sessionId);
		if (plan.steps.length === 0) {
			throw badRequest('This session has no steps to run');
		}

		// Only one workout can be in flight; picking up a new one closes the old.
		const active = workoutRepository.findActive();
		if (active) {
			workoutRepository.finish(active.id, { status: 'abandoned', notes: active.notes });
		}

		const workout = workoutRepository.create({
			sessionId: session.id,
			sessionName: session.name,
			routineId: input.routineId,
			occurrenceDate: input.occurrenceDate,
			plan
		});

		return { ...workout, steps: [] };
	},

	get(id: string): WorkoutDetail {
		const workout = workoutRepository.findDetail(id);
		if (!workout) throw notFound('Workout not found');
		return workout;
	},

	/** The workout to offer as "resume", if any. */
	active(): Workout | null {
		return workoutRepository.findActive();
	},

	history(query: WorkoutQuery): Workout[] {
		return workoutRepository.list(query);
	},

	logStep(workoutId: string, input: WorkoutStepLogInput): WorkoutStepLog {
		const workout = workoutRepository.findById(workoutId);
		if (!workout) throw notFound('Workout not found');
		if (workout.status !== 'in_progress') {
			throw badRequest('This workout is already finished');
		}
		if (input.stepIndex >= workout.plan.steps.length) {
			throw badRequest('That step is not part of this workout');
		}
		return workoutRepository.upsertStep(workoutId, input);
	},

	finish(id: string, input: WorkoutFinish): WorkoutDetail {
		const existing = workoutRepository.findById(id);
		if (!existing) throw notFound('Workout not found');

		const workout = workoutRepository.finish(id, { status: input.status, notes: input.notes });
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

		return this.get(id);
	},

	remove(id: string): void {
		const workout = workoutRepository.findById(id);
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
		workoutRepository.remove(id);
	}
};
