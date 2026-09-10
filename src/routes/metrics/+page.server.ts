import { metricsService } from '$server/services/index.ts';
import { requireUser } from '$server/http/session.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = ({ locals }) => ({
	metrics: metricsService.snapshot(requireUser(locals).id)
});
