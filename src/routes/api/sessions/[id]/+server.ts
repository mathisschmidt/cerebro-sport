import { sessionInputSchema } from '$domain/models/session.ts';
import { sessionService } from '$server/services/index.ts';
import { authed, readBody } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const GET = authed(({ params }, user) =>
	sessionService.get(user.id, requireParam(params, 'id'))
);

/** PUT, not PATCH: a session is always edited and saved as a whole tree. */
export const PUT = authed(async ({ params, request }, user) =>
	sessionService.update(
		user.id,
		requireParam(params, 'id'),
		await readBody(request, sessionInputSchema)
	)
);

export const DELETE = authed(({ params }, user) => {
	sessionService.remove(user.id, requireParam(params, 'id'));
	return null;
});
