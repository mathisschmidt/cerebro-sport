import { metricsService } from '$server/services/index.ts';
import { endpoint } from '$server/http/respond.ts';

export const GET = endpoint(() => metricsService.snapshot());
