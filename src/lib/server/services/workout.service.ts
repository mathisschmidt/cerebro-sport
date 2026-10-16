import type {
	Workout,
	WorkoutDetail,
	WorkoutFinish,
	WorkoutQuery,
	WorkoutStart,
	WorkoutStepLog,
	WorkoutStepLogInput
} from '$domain/models/workout.ts';
import { isRecorded } from '$domain/models/workout.ts';
import { workoutRepository } from '../repositories/workout.repository.ts';
import { routineRepository } from '../repositories/routine.repository.ts';
import { sessionService } from './session.service.ts';
import { badRequest, notFound } from '../http/errors.ts';

/**
 * Running a session.
 *
 * A workout freezes the plan it started from, so editing the session afterwards
 * never rewrites what was actually done. Steps are logged as they finish rather
 * than in one batch at the end, so leaving mid-session keeps what was done.
 *
 * A run is never resumed. However it is left — the leave dialog, a closed tab,
 * a reload, starting another session — it ends there, through `finish`.
 */
export const workoutService = {
	start(userId: string, input: WorkoutStart): WorkoutDetail {
		const session = sessionService.get(userId, input.sessionId);
		const plan = sessionService.plan(userId, input.sessionId);
		if (plan.steps.length === 0) {
			throw badRequest('This session has no steps to run');
		}

		// Only one workout can be in flight; starting a new one ends the old.
		const active = workoutRepository.findActive(userId);
		if (active) this.leave(userId, active.id);

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

	history(userId: string, query: WorkoutQuery): Workout[] {
		return workoutRepository.list(userId, query);
	},

	/** How many recorded runs a session has — what resetting its history would delete. */
	recordedCount(userId: string, sessionId: string): number {
		return workoutRepository
			.list(userId, { sessionId, limit: 500, offset: 0 })
			.filter(isRecorded).length;
	},

	/**
	 * Starts a session's history over, for when it changed enough that past runs
	 * no longer time the same thing. Its runs are deleted; routine ticks are kept,
	 * so streaks and the calendar's planned days do not rewrite themselves.
	 */
	resetHistory(userId: string, sessionId: string): { removed: number } {
		sessionService.get(userId, sessionId);
		const ids = workoutRepository.removeFinishedForSession(userId, sessionId);
		routineRepository.detachWorkouts(ids);
		return { removed: ids.length };
	},

	/** The latest workouts that count in the metrics, finished or ended early. */
	recent(userId: string, limit: number): Workout[] {
		return workoutRepository
			.list(userId, { limit: limit * 3, offset: 0 })
			.filter(isRecorded)
			.slice(0, limit);
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

	/**
	 * Ends a run. Idempotent, because a closed tab and the leave dialog can both
	 * report the same ending. A run left with nothing done holds nothing worth
	 * keeping, so it is deleted and `null` comes back.
	 */
	finish(userId: string, id: string, input: WorkoutFinish): WorkoutDetail | null {
		const existing = workoutRepository.findById(userId, id);
		if (!existing) throw notFound('Workout not found');
		if (existing.status !== 'in_progress') return this.get(userId, id);

		if (input.status === 'abandoned') {
			workoutRepository.refreshTotals(id);
			if ((workoutRepository.findById(userId, id)?.completedStepCount ?? 0) === 0) {
				this.remove(userId, id);
				return null;
			}
		}

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

	/** Ends a run the athlete walked away from, keeping whatever was done. */
	leave(userId: string, id: string): void {
		this.finish(userId, id, { status: 'abandoned', notes: '' });
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
