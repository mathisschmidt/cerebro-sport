import { exerciseService, sessionService } from '$server/services/index.ts';
import { todayIso } from '$domain/services/date.ts';
import type { PageServerLoad } from './$types.ts';

/**
 * The Coach page resolves packs in the browser for an instant preview, so it
 * needs the library up front — names only, which is all the resolver matches on.
 */
export const load: PageServerLoad = () => ({
	today: todayIso(),
	exercises: exerciseService
		.list({ limit: 500, offset: 0 })
		.items.map((exercise) => ({ id: exercise.id, name: exercise.name })),
	sessions: sessionService
		.list({ limit: 200, offset: 0 })
		.items.map((session) => ({ id: session.id, name: session.name }))
});
