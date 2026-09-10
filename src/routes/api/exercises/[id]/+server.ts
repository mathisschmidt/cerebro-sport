import { exercisePatchSchema } from '$domain/models/exercise.ts';
import { exerciseService } from '$server/services/index.ts';
import { endpoint, readBody } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const GET = endpoint(({ params }) => exerciseService.get(requireParam(params, 'id')));

export const PATCH = endpoint(async ({ params, request }) =>
	exerciseService.update(requireParam(params, 'id'), await readBody(request, exercisePatchSchema))
);

export const DELETE = endpoint(({ params }) => {
	exerciseService.remove(requireParam(params, 'id'));
	return null;
});
