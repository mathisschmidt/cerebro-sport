import { error } from '@sveltejs/kit';
import { metricsService, routineService, sessionService } from '$server/services/index.ts';
import { isAppError } from '$server/http/errors.ts';
import { requireUser } from '$server/http/session.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	const { id: userId } = requireUser(locals);
	try {
		const session = sessionService.get(userId, params.id);
		return {
			session,
			metrics: metricsService.forSession(userId, params.id),
			routines: routineService.list(userId).filter((routine) => routine.sessionId === params.id)
		};
	} catch (caught) {
		if (isAppError(caught)) error(caught.status, { message: caught.message });
		throw caught;
	}
};
