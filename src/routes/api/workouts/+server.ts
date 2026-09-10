import { workoutQuerySchema, workoutStartSchema } from '$domain/models/workout.ts';
import { workoutService } from '$server/services/index.ts';
import { authed, readBody, readQuery } from '$server/http/respond.ts';

export const GET = authed(({ url }, user) =>
	workoutService.history(user.id, readQuery(url, workoutQuerySchema))
);

export const POST = authed(
	async ({ request }, user) =>
		workoutService.start(user.id, await readBody(request, workoutStartSchema)),
	{ status: 201 }
);
