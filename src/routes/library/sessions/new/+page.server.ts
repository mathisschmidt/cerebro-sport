import { exerciseService } from '$server/services/index.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = () => ({
	exercises: exerciseService.list({ limit: 500, offset: 0 }).items
});
