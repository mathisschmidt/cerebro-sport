import type { IsoDate } from '$domain/models/common.ts';
import type { MetricsSnapshot, SessionMetrics, StreakMetrics } from '$domain/models/metrics.ts';
import { addDays, todayIso } from '$domain/services/date.ts';
import {
	buildMetricsSnapshot,
	buildSessionMetrics,
	buildStreakMetrics
} from '$domain/services/metrics.ts';
import { sessionRepository } from '../repositories/session.repository.ts';
import { workoutRepository } from '../repositories/workout.repository.ts';
import { routineService } from './routine.service.ts';
import { notFound } from '../http/errors.ts';

/** How far back the dashboard looks by default. */
export const DEFAULT_METRICS_WINDOW_DAYS = 90;

/**
 * Loads what the pure metrics functions need and hands the result over. No
 * arithmetic lives here — it is all in `$domain/services/metrics`.
 */
export const metricsService = {
	snapshot(options: { today?: IsoDate; windowDays?: number } = {}): MetricsSnapshot {
		const today = options.today ?? todayIso();
		const windowDays = options.windowDays ?? DEFAULT_METRICS_WINDOW_DAYS;
		const from = addDays(today, -(windowDays - 1));

		const workouts = workoutRepository.listDetails({ limit: 500, offset: 0 });
		const occurrences = routineService.occurrences(from, today);

		// Sessions that were deleted still own history, so the two sources are merged.
		const sessions = new Map<string, { id: string; name: string }>();
		for (const session of workoutRepository.listHistoricSessions()) sessions.set(session.id, session);
		for (const session of sessionRepository.listAllIdsAndNames()) sessions.set(session.id, session);

		return buildMetricsSnapshot({
			workouts,
			occurrences,
			sessions: [...sessions.values()],
			today
		});
	},

	/**
	 * Just the streak and calendar. The home page shows only these, and computing
	 * per-session progress for it would load every step log for nothing.
	 */
	streak(options: { today?: IsoDate; windowDays?: number } = {}): StreakMetrics {
		const today = options.today ?? todayIso();
		const windowDays = options.windowDays ?? DEFAULT_METRICS_WINDOW_DAYS;
		const from = addDays(today, -(windowDays - 1));

		return buildStreakMetrics(
			routineService.occurrences(from, today),
			workoutRepository.listDetails({ from, limit: 500, offset: 0 }),
			{ today, windowDays }
		);
	},

	forSession(sessionId: string): SessionMetrics {
		const summary = sessionRepository.findSummary(sessionId);
		const historic = workoutRepository
			.listHistoricSessions()
			.find((session) => session.id === sessionId);
		const name = summary?.name ?? historic?.name;
		if (!name) throw notFound('Session not found');

		const workouts = workoutRepository.listDetails({ sessionId, limit: 500, offset: 0 });
		return buildSessionMetrics(sessionId, name, workouts);
	}
};
