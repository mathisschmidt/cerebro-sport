import { eq } from 'drizzle-orm';
import type { AppSettings } from '$domain/models/settings.ts';
import { DEFAULT_SETTINGS } from '$domain/models/settings.ts';
import { db, schema } from '../db/client.ts';

const { settings } = schema;

/** There is exactly one settings row, and this is its id. */
const ROW_ID = 'app';

export const settingsRepository = {
	/** Reads the single row, falling back to defaults before it is first written. */
	get(): AppSettings {
		const row = db.select().from(settings).where(eq(settings.id, ROW_ID)).get();
		if (!row) return { ...DEFAULT_SETTINGS };
		return { registrationEnabled: row.registrationEnabled };
	},

	save(next: AppSettings): AppSettings {
		db.insert(settings)
			.values({
				id: ROW_ID,
				registrationEnabled: next.registrationEnabled,
				updatedAt: new Date().toISOString()
			})
			.onConflictDoUpdate({
				target: settings.id,
				set: {
					registrationEnabled: next.registrationEnabled,
					updatedAt: new Date().toISOString()
				}
			})
			.run();
		return this.get();
	}
};
