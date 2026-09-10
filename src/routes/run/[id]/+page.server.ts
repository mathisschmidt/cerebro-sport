import { error } from '@sveltejs/kit';
import { workoutService } from '$server/services/index.ts';
import { isAppError } from '$server/http/errors.ts';
import { requireUser } from '$server/http/session.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	try {
		return { workout: workoutService.get(requireUser(locals).id, params.id) };
	} catch (caught) {
		if (isAppError(caught)) error(caught.status, { message: caught.message });
		throw caught;
	}
};
