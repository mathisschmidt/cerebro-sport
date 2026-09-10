import { addDays, todayIso } from '$domain/services/date.ts';
import {
	metricsService,
	routineService,
	sessionService,
	workoutService
} from '$server/services/index.ts';
import { requireUser } from '$server/http/session.ts';
import type { PageServerLoad } from './$types.ts';

/**
 * Everything the day view needs, in one round trip. The heavy per-step metrics
 * are deliberately not loaded here — the home page only shows the streak.
 */
export const load: PageServerLoad = ({ locals }) => {
	const { id } = requireUser(locals);
	const today = todayIso();

	return {
		today,
		occurrences: routineService.day(id, today),
		upcoming: routineService.occurrences(id, addDays(today, 1), addDays(today, 7)),
		streak: metricsService.streak(id),
		activeWorkout: workoutService.active(id),
		sessions: sessionService.list(id, { limit: 100, offset: 0 }).items,
		recentWorkouts: workoutService.history(id, { status: 'completed', limit: 4, offset: 0 })
	};
};
