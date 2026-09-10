import { workoutStepLogInputSchema } from '$domain/models/workout.ts';
import { workoutService } from '$server/services/index.ts';
import { authed, readBody } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

/**
 * Called by the runner as each step ends, so an interrupted session keeps
 * everything already done.
 */
export const POST = authed(async ({ params, request }, user) => {
	workoutService.logStep(
		user.id,
		requireParam(params, 'id'),
		await readBody(request, workoutStepLogInputSchema)
	);
	return null;
});
