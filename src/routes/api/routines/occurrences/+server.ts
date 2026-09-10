import { z } from 'zod';
import { isoDateSchema } from '$domain/models/common.ts';
import { occurrenceResolutionSchema } from '$domain/models/routine.ts';
import { routineService } from '$server/services/index.ts';
import { authed, readBody, readQuery } from '$server/http/respond.ts';

const rangeSchema = z.object({ from: isoDateSchema, to: isoDateSchema });

export const GET = authed(({ url }, user) => {
	const range = readQuery(url, rangeSchema);
	return routineService.occurrences(user.id, range.from, range.to);
});

/** Ticking an occurrence off (or un-ticking it) without running the session. */
export const POST = authed(async ({ request }, user) =>
	routineService.resolve(user.id, await readBody(request, occurrenceResolutionSchema))
);
