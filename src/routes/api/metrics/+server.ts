import { metricsService } from '$server/services/index.ts';
import { authed } from '$server/http/respond.ts';

export const GET = authed((_event, user) => metricsService.snapshot(user.id));
