import { metricsService } from '$server/services/index.ts';
import { authed } from '$server/http/respond.ts';
import { requireParam } from '$server/http/params.ts';

export const GET = authed(({ params }, user) =>
	metricsService.forSession(user.id, requireParam(params, 'sessionId'))
);
