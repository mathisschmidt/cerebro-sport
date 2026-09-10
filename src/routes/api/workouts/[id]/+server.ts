import { workoutService } from '$server/services/index.ts';
import { authed } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const GET = authed(({ params }, user) =>
	workoutService.get(user.id, requireParam(params, 'id'))
);

export const DELETE = authed(({ params }, user) => {
	workoutService.remove(user.id, requireParam(params, 'id'));
	return null;
});
