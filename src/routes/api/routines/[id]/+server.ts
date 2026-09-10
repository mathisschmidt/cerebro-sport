import { routinePatchSchema } from '$domain/models/routine.ts';
import { routineService } from '$server/services/index.ts';
import { endpoint, readBody } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const GET = endpoint(({ params }) => routineService.get(requireParam(params, 'id')));

export const PATCH = endpoint(async ({ params, request }) =>
	routineService.update(requireParam(params, 'id'), await readBody(request, routinePatchSchema))
);

export const DELETE = endpoint(({ params }) => {
	routineService.remove(requireParam(params, 'id'));
	return null;
});
