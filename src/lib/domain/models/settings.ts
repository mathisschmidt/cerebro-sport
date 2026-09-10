import { z } from 'zod';

/**
 * Instance-wide settings. One row in the database, because an admin changes
 * these while the app is running.
 */

export const appSettingsSchema = z.object({
	/**
	 * When false the public sign-up form is closed and only an admin can add
	 * accounts. Closed by default: a fresh instance should not be open to
	 * whoever finds it.
	 */
	registrationEnabled: z.boolean()
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const appSettingsPatchSchema = appSettingsSchema.partial();
export type AppSettingsPatch = z.infer<typeof appSettingsPatchSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
	registrationEnabled: false
};
