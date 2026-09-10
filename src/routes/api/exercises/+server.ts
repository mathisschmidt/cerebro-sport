import { exerciseInputSchema } from '$domain/models/exercise.ts';
import { pageQuerySchema } from '$domain/models/common.ts';
import { exerciseService } from '$server/services/index.ts';
import { endpoint, readBody, readQuery } from '$server/http/respond.ts';

export const GET = endpoint(({ url }) => exerciseService.list(readQuery(url, pageQuerySchema)));

export const POST = endpoint(
	async ({ request }) => exerciseService.create(await readBody(request, exerciseInputSchema)),
	{ status: 201 }
);
