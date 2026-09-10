import { appSettingsPatchSchema } from '$domain/models/settings.ts';
import { settingsService } from '$server/services/index.ts';
import { adminOnly, readBody } from '$server/http/respond.ts';

export const GET = adminOnly(() => settingsService.get());

export const PATCH = adminOnly(async ({ request }) =>
	settingsService.update(await readBody(request, appSettingsPatchSchema))
);
