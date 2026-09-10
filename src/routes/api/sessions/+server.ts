import { pageQuerySchema } from '$domain/models/common.ts';
import { sessionInputSchema } from '$domain/models/session.ts';
import { sessionService } from '$server/services/index.ts';
import { authed, readBody, readQuery } from '$server/http/respond.ts';

export const GET = authed(({ url }, user) =>
	sessionService.list(user.id, readQuery(url, pageQuerySchema))
);

export const POST = authed(
	async ({ request }, user) =>
		sessionService.create(user.id, await readBody(request, sessionInputSchema)),
	{ status: 201 }
);
