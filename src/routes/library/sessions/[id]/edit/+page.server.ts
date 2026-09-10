import { error } from '@sveltejs/kit';
import { exerciseService, sessionService } from '$server/services/index.ts';
import { isAppError } from '$server/http/errors.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = ({ params }) => {
	try {
		return {
			session: sessionService.get(params.id),
			exercises: exerciseService.list({ limit: 500, offset: 0 }).items
		};
	} catch (caught) {
		if (isAppError(caught)) error(caught.status, { message: caught.message });
		throw caught;
	}
};
