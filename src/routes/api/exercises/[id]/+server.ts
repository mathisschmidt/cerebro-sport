import { exercisePatchSchema } from '$domain/models/exercise.ts';
import { exerciseService } from '$server/services/index.ts';
import { authed, readBody } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const GET = authed(({ params }, user) =>
	exerciseService.get(user.id, requireParam(params, 'id'))
);

export const PATCH = authed(async ({ params, request }, user) =>
	exerciseService.update(
		user.id,
		requireParam(params, 'id'),
		await readBody(request, exercisePatchSchema)
	)
);

export const DELETE = authed(({ params }, user) => {
	exerciseService.remove(user.id, requireParam(params, 'id'));
	return null;
});
