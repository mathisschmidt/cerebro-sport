import { routineInputSchema } from '$domain/models/routine.ts';
import { routineService } from '$server/services/index.ts';
import { authed, readBody } from '$server/http/respond.ts';

export const GET = authed((_event, user) => routineService.list(user.id));

export const POST = authed(
	async ({ request }, user) =>
		routineService.create(user.id, await readBody(request, routineInputSchema)),
	{ status: 201 }
);
