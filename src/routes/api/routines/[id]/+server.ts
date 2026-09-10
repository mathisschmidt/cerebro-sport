import { routinePatchSchema } from '$domain/models/routine.ts';
import { routineService } from '$server/services/index.ts';
import { authed, readBody } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const GET = authed(({ params }, user) =>
	routineService.get(user.id, requireParam(params, 'id'))
);

export const PATCH = authed(async ({ params, request }, user) =>
	routineService.update(
		user.id,
		requireParam(params, 'id'),
		await readBody(request, routinePatchSchema)
	)
);

export const DELETE = authed(({ params }, user) => {
	routineService.remove(user.id, requireParam(params, 'id'));
	return null;
});
