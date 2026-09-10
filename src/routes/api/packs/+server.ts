import { importRequestSchema } from '$domain/models/pack.ts';
import { packService } from '$server/services/index.ts';
import { authed, readBody } from '$server/http/respond.ts';

/**
 * Imports a training pack. The body is the pack itself plus what to skip; the
 * server re-resolves it against the live library before writing anything.
 */
export const POST = authed(
	async ({ request }, user) => {
		const { pack, options } = await readBody(request, importRequestSchema);
		return packService.apply(user.id, pack, options);
	},
	{ status: 201 }
);
