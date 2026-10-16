import { error, redirect } from '@sveltejs/kit';
import { workoutService } from '$server/services/index.ts';
import { isAppError } from '$server/http/errors.ts';
import { requireUser } from '$server/http/session.ts';
import type { PageServerLoad } from './$types.ts';

/**
 * A run is never resumed. A finished one has nothing to run; an unfinished one
 * that already has steps logged was left — by a reload, a closed tab, a dead
 * battery — and leaving ends it, so it is closed here and the athlete sent home.
 */
export const load: PageServerLoad = ({ params, locals }) => {
	const userId = requireUser(locals).id;
	let workout;
	try {
		workout = workoutService.get(userId, params.id);
	} catch (caught) {
		if (isAppError(caught)) error(caught.status, { message: caught.message });
		throw caught;
	}

	if (workout.status !== 'in_progress') redirect(303, '/');
	if (workout.steps.length > 0) {
		workoutService.leave(userId, workout.id);
		redirect(303, '/');
	}

	return { workout };
};
