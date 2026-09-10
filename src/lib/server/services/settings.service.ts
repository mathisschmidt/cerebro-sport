import type { AppSettings, AppSettingsPatch } from '$domain/models/settings.ts';
import { settingsRepository } from '../repositories/settings.repository.ts';

/**
 * Instance settings. Small enough that the service is a pass-through today,
 * but it is the seam where a rule like "registration cannot be opened without
 * an admin email configured" would live.
 */
export const settingsService = {
	get(): AppSettings {
		return settingsRepository.get();
	},

	update(patch: AppSettingsPatch): AppSettings {
		const current = settingsRepository.get();
		return settingsRepository.save({
			registrationEnabled: patch.registrationEnabled ?? current.registrationEnabled
		});
	}
};
