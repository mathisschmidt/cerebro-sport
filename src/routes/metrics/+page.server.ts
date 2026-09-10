import { metricsService } from '$server/services/index.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = () => ({ metrics: metricsService.snapshot() });
