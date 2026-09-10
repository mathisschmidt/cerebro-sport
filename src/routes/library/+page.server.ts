import { exerciseService, routineService, sessionService } from '$server/services/index.ts';
import { requireUser } from '$server/http/session.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = ({ locals }) => {
	const { id } = requireUser(locals);
	return {
		exercises: exerciseService.list(id, { limit: 200, offset: 0 }),
		sessions: sessionService.list(id, { limit: 200, offset: 0 }),
		routines: routineService.list(id)
	};
};
