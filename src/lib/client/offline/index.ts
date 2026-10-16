import { browser } from '$app/environment';
import * as idb from './idb.ts';
import { connectivity } from './connectivity.svelte.ts';
import { outbox } from './outbox.svelte.ts';
import { runs } from './runs.svelte.ts';
import { snapshot } from './snapshot.svelte.ts';

/**
 * Offline training, wired together. The root layout calls `startOffline` with
 * the signed-in account and `resetOffline` on sign-out; everything else reads
 * the stores re-exported here.
 */

export { connectivity } from './connectivity.svelte.ts';
export { outbox } from './outbox.svelte.ts';
export {
	runs,
	completedStepCount,
	beat,
	stopBeat,
	OfflineUnavailableError,
	type LocalRun
} from './runs.svelte.ts';
export { snapshot } from './snapshot.svelte.ts';
export { updates } from './updates.svelte.ts';

/** Pages the service worker keeps ready, so they open offline even if never visited. */
const WARM_PAGES = ['/', '/library', '/metrics'];

let startedFor: string | null = null;

/** Sets the account, ends runs left behind, delivers what is queued and refreshes the caches. */
export async function startOffline(userId: string): Promise<void> {
	if (!browser || startedFor === userId) return;
	startedFor = userId;

	outbox.setUser(userId);
	runs.setUser(userId);
	await snapshot.init(userId);

	// A run whose page is gone was left, and leaving ends it. The live one —
	// open in another tab — keeps going.
	await runs.endOpenRuns({ exceptBeating: true });

	await outbox.flush();
	await snapshot.refresh();
	warmPages();
}

/** Called whenever the app is in front and online, to keep the offline copy fresh. */
export function refreshOffline(): void {
	if (!startedFor || !connectivity.online) return;
	void snapshot.refresh().then(warmPages);
}

function warmPages(): void {
	if (!connectivity.online) return;
	navigator.serviceWorker?.controller?.postMessage({ type: 'warm', paths: WARM_PAGES });
}

/**
 * Sign-out: wipe the runs, the queue, the snapshot and the service worker's
 * page cache, so the next person on this device can read nothing offline.
 */
export async function resetOffline(): Promise<void> {
	if (!browser) return;
	startedFor = null;
	outbox.setUser(null);
	runs.setUser(null);
	snapshot.forget();
	await idb.clearAll().catch(() => {});
	try {
		localStorage.removeItem('cerebro-sport:active-run');
	} catch {
		// Nothing stored.
	}
	if ('caches' in window) {
		for (const name of await caches.keys()) {
			if (name.startsWith('pages-')) await caches.delete(name);
		}
	}
}
