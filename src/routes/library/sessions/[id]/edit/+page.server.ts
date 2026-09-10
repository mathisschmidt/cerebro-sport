import { error } from '@sveltejs/kit';
import { exerciseService, sessionService } from '$server/services/index.ts';
import { isAppError } from '$server/http/errors.ts';
import { requireUser } from '$server/http/session.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	const { id: userId } = requireUser(locals);
	try {
		return {
			session: sessionService.get(userId, params.id),
			exercises: exerciseService.list(userId, { limit: 500, offset: 0 }).items
		};
	} catch (caught) {
		if (isAppError(caught)) error(caught.status, { message: caught.message });
		throw caught;
	}
};
