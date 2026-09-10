import { metricsService } from '$server/services/index.ts';
import { endpoint } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const GET = endpoint(({ params }) =>
	metricsService.forSession(requireParam(params, 'sessionId'))
);
