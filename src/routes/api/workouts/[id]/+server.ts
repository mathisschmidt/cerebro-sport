import { workoutService } from '$server/services/index.ts';
import { endpoint } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const GET = endpoint(({ params }) => workoutService.get(requireParam(params, 'id')));

export const DELETE = endpoint(({ params }) => {
	workoutService.remove(requireParam(params, 'id'));
	return null;
});
