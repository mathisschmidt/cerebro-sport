import { exerciseService, routineService, sessionService } from '$server/services/index.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = () => ({
	exercises: exerciseService.list({ limit: 200, offset: 0 }),
	sessions: sessionService.list({ limit: 200, offset: 0 }),
	routines: routineService.list()
});
