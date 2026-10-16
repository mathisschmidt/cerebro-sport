import { sessionService } from '$server/services/index.ts';
import { authed } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

/** The session's runnable plan as of now — what an online start runs. */
export const GET = authed(({ params }, user) =>
	sessionService.plan(user.id, requireParam(params, 'id'))
);
