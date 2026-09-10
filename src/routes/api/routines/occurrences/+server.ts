import { z } from 'zod';
import { isoDateSchema } from '$domain/models/common.ts';
import { occurrenceResolutionSchema } from '$domain/models/routine.ts';
import { routineService } from '$server/services/index.ts';
import { endpoint, readBody, readQuery } from '$server/http/respond.ts';

const rangeSchema = z.object({ from: isoDateSchema, to: isoDateSchema });

export const GET = endpoint(({ url }) => {
	const range = readQuery(url, rangeSchema);
	return routineService.occurrences(range.from, range.to);
});

/** Ticking an occurrence off (or un-ticking it) without running the session. */
export const POST = endpoint(async ({ request }) =>
	routineService.resolve(await readBody(request, occurrenceResolutionSchema))
);
