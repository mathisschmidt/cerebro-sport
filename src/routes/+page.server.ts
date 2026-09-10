import { addDays, todayIso } from '$domain/services/date.ts';
import {
	metricsService,
	routineService,
	sessionService,
	workoutService
} from '$server/services/index.ts';
import type { PageServerLoad } from './$types.ts';

/**
 * Everything the day view needs, in one round trip. The heavy per-step metrics
 * are deliberately not loaded here — the home page only shows the streak.
 */
export const load: PageServerLoad = () => {
	const today = todayIso();

	return {
		today,
		occurrences: routineService.day(today),
		upcoming: routineService.occurrences(addDays(today, 1), addDays(today, 7)),
		streak: metricsService.streak(),
		activeWorkout: workoutService.active(),
		sessions: sessionService.list({ limit: 100, offset: 0 }).items,
		recentWorkouts: workoutService.history({ status: 'completed', limit: 4, offset: 0 })
	};
};
