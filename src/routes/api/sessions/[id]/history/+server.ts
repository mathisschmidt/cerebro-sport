import { workoutService } from '$server/services/index.ts';
import { authed } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

/** Deletes the session's past runs; the session itself is untouched. */
export const DELETE = authed(({ params }, user) =>
	workoutService.resetHistory(user.id, requireParam(params, 'id'))
);
