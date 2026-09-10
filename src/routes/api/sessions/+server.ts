import { pageQuerySchema } from '$domain/models/common.ts';
import { sessionInputSchema } from '$domain/models/session.ts';
import { sessionService } from '$server/services/index.ts';
import { endpoint, readBody, readQuery } from '$server/http/respond.ts';

export const GET = endpoint(({ url }) => sessionService.list(readQuery(url, pageQuerySchema)));

export const POST = endpoint(
	async ({ request }) => sessionService.create(await readBody(request, sessionInputSchema)),
	{ status: 201 }
);
