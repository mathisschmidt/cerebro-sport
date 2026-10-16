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
import { badRequest, conflict, notFound } from '../http/errors.ts';

/**
 * Running a session.
 *
 * A workout freezes the plan it started from, so editing the session afterwards
 * never rewrites what was actually done. Steps are logged as they finish rather
 * than in one batch at the end, so leaving mid-session keeps what was done.
 *
 * A run is never resumed. However it is left — the leave dialog, a closed tab,
 * a reload, starting another session — it ends there, through `finish`.
 *
 * Runs are local-first: the phone starts them, possibly offline, and replays
 * start, steps and finish from its outbox. So every write here is idempotent,
 * and a replay arriving hours late must still land as if it were on time.
 */
export const workoutService = {
	start(userId: string, input: WorkoutStart): WorkoutDetail {
		// A replayed start: the run already exists, nothing more to do.
		if (input.id) {
			const existing = workoutRepository.findDetail(userId, input.id);
			if (existing) return existing;
			if (workoutRepository.idTaken(input.id)) throw conflict('That workout id is already in use');
		}

		// The phone sends the plan it actually ran, which may predate an edit or
		// outlive the session itself; without one, the run uses today's plan.
		let plan = input.plan;
		if (plan) {
			if (plan.sessionId !== input.sessionId) {
				throw badRequest('The plan does not belong to that session');
			}
		} else {
			sessionService.get(userId, input.sessionId);
			plan = sessionService.plan(userId, input.sessionId);
			if (plan.steps.length === 0) throw badRequest('This session has no steps to run');
		}

		// Only one workout can be in flight; starting a new one ends those still
		// open — but only older ones, so a run synced late never ends a newer one.
		// They are ended, never deleted, even with no step yet: another phone may
		// still be holding their steps in its outbox. Empty, they count nowhere.
		const startedAt = input.startedAt ?? new Date().toISOString();
		for (const active of workoutRepository.findActiveBefore(userId, startedAt)) {
			workoutRepository.finish(userId, active.id, { status: 'abandoned', notes: active.notes });
		}

		const workout = workoutRepository.create({
			userId,
			sessionId: input.sessionId,
			sessionName: plan.sessionName,
			routineId: input.routineId,
			occurrenceDate: input.occurrenceDate,
			plan,
			id: input.id,
			startedAt
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
		// Steps are accepted after the end too: a run another device's start
		// closed while this phone was offline must still get its steps when they
		// sync. The write is an upsert on the step index, so a replay is harmless.
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
			notes: input.notes,
			completedAt: input.completedAt
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
