import { exerciseService } from '$server/services/index.ts';
import { requireUser } from '$server/http/session.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = ({ locals }) => ({
	exercises: exerciseService.list(requireUser(locals).id, { limit: 500, offset: 0 }).items
});
