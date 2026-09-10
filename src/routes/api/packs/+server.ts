import { importRequestSchema } from '$domain/models/pack.ts';
import { packService } from '$server/services/index.ts';
import { endpoint, readBody } from '$server/http/respond.ts';

/**
 * Imports a training pack. The body is the pack itself plus what to skip; the
 * server re-resolves it against the live library before writing anything.
 */
export const POST = endpoint(
	async ({ request }) => {
		const { pack, options } = await readBody(request, importRequestSchema);
		return packService.apply(pack, options);
	},
	{ status: 201 }
);
