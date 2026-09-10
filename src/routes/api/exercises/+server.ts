import { exerciseInputSchema } from '$domain/models/exercise.ts';
import { pageQuerySchema } from '$domain/models/common.ts';
import { exerciseService } from '$server/services/index.ts';
import { authed, readBody, readQuery } from '$server/http/respond.ts';

export const GET = authed(({ url }, user) =>
	exerciseService.list(user.id, readQuery(url, pageQuerySchema))
);

export const POST = authed(
	async ({ request }, user) =>
		exerciseService.create(user.id, await readBody(request, exerciseInputSchema)),
	{ status: 201 }
);
