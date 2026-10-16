import { redirect } from '@sveltejs/kit';
import { runs } from '$client/offline/index.ts';
import type { PageLoad } from './$types.ts';

/**
 * A run lives on the phone, so this page loads in the browser only — it must
 * open with no network at all.
 *
 * A run is never resumed. Only a fresh run is handed to the runner: one that
 * is already finished, or unknown here, has nothing to run, and one with steps
 * already logged was left — by a reload, a closed tab, a dead battery — and
 * leaving ends it, so it is closed and the athlete sent home.
 */
export const ssr = false;

export const load: PageLoad = async ({ params, parent }) => {
	const { user } = await parent();
	const run = await runs.get(params.id);
	if (!run || run.userId !== user?.id || run.status !== 'in_progress') redirect(307, '/');
	if (Object.keys(run.steps).length > 0) {
		await runs.leave(run.id);
		redirect(307, '/');
	}
	return { workout: run };
};
