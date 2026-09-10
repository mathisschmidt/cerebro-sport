import { routineInputSchema } from '$domain/models/routine.ts';
import { routineService } from '$server/services/index.ts';
import { endpoint, readBody } from '$server/http/respond.ts';

export const GET = endpoint(() => routineService.list());

export const POST = endpoint(
	async ({ request }) => routineService.create(await readBody(request, routineInputSchema)),
	{ status: 201 }
);
