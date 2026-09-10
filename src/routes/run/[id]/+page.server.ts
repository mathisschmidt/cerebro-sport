import { error } from '@sveltejs/kit';
import { workoutService } from '$server/services/index.ts';
import { isAppError } from '$server/http/errors.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = ({ params }) => {
	try {
		return { workout: workoutService.get(params.id) };
	} catch (caught) {
		if (isAppError(caught)) error(caught.status, { message: caught.message });
		throw caught;
	}
};
