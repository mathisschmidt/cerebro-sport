import { workoutQuerySchema, workoutStartSchema } from '$domain/models/workout.ts';
import { workoutService } from '$server/services/index.ts';
import { endpoint, readBody, readQuery } from '$server/http/respond.ts';

export const GET = endpoint(({ url }) => workoutService.history(readQuery(url, workoutQuerySchema)));

export const POST = endpoint(
	async ({ request }) => workoutService.start(await readBody(request, workoutStartSchema)),
	{ status: 201 }
);
