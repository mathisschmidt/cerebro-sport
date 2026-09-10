import { workoutFinishSchema } from '$domain/models/workout.ts';
import { workoutService } from '$server/services/index.ts';
import { authed, readBody } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const POST = authed(async ({ params, request }, user) =>
	workoutService.finish(
		user.id,
		requireParam(params, 'id'),
		await readBody(request, workoutFinishSchema)
	)
);
