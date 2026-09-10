import { adminService, settingsService } from '$server/services/index.ts';
import { requireAdmin } from '$server/http/session.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = ({ locals }) => {
	requireAdmin(locals);
	return {
		users: adminService.listUsers(),
		settings: settingsService.get()
	};
};
