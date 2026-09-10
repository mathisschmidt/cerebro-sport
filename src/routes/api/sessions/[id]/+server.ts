import { sessionInputSchema } from '$domain/models/session.ts';
import { sessionService } from '$server/services/index.ts';
import { endpoint, readBody } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const GET = endpoint(({ params }) => sessionService.get(requireParam(params, 'id')));

/** PUT, not PATCH: a session is always edited and saved as a whole tree. */
export const PUT = endpoint(async ({ params, request }) =>
	sessionService.update(requireParam(params, 'id'), await readBody(request, sessionInputSchema))
);

export const DELETE = endpoint(({ params }) => {
	sessionService.remove(requireParam(params, 'id'));
	return null;
});
