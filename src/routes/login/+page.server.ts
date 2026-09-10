import { adminService, settingsService } from '$server/services/index.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = () => ({
	registrationEnabled: settingsService.get().registrationEnabled,
	/**
	 * A brand new instance has only the account created at boot, so the sign-in
	 * screen can say what it is. Once anyone else exists the hint disappears.
	 */
	freshInstall: adminService.userCount() === 1
});
