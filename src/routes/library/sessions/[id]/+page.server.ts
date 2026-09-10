import { error } from '@sveltejs/kit';
import { metricsService, routineService, sessionService } from '$server/services/index.ts';
import { isAppError } from '$server/http/errors.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = ({ params }) => {
	try {
		const session = sessionService.get(params.id);
		return {
			session,
			metrics: metricsService.forSession(params.id),
			routines: routineService.list().filter((routine) => routine.sessionId === params.id)
		};
	} catch (caught) {
		if (isAppError(caught)) error(caught.status, { message: caught.message });
		throw caught;
	}
};
