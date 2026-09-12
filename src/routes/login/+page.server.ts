import { settingsService } from '$server/services/index.ts';
import type { PageServerLoad } from './$types.ts';

export const load: PageServerLoad = () => ({
	registrationEnabled: settingsService.get().registrationEnabled
});
