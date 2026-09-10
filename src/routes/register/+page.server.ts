import { redirect } from '@sveltejs/kit';
import { settingsService } from '$server/services/index.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = () => {
	// The server decides, not the link: reaching this URL directly while
	// registration is closed must not present a form that cannot succeed.
	if (!settingsService.get().registrationEnabled) redirect(303, '/login');
	return {};
};
