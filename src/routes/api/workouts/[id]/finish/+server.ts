import { workoutFinishSchema } from '$domain/models/workout.ts';
import { workoutService } from '$server/services/index.ts';
import { endpoint, readBody } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const POST = endpoint(async ({ params, request }) =>
	workoutService.finish(requireParam(params, 'id'), await readBody(request, workoutFinishSchema))
);
