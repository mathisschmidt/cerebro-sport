import { browser } from '$app/environment';
import type { OfflineSnapshot } from '$domain/models/offline.ts';
import type { SessionPlan } from '$domain/models/plan.ts';
import * as idb from './idb.ts';
import { connectivity } from './connectivity.svelte.ts';

const KEY = 'snapshot';

/** A snapshot younger than this is not fetched again. */
const FRESH_MS = 5 * 60_000;

/**
 * The phone's copy of what it needs to train offline. Replaced whole on every
 * refresh, never edited locally, and only ever shown to the account it was
 * fetched for.
 */
class SnapshotStore {
	/**
	 * Raw, not deeply reactive: it is only ever replaced whole, and a plan taken
	 * from it is stored in IndexedDB, which cannot clone a reactive proxy.
	 */
	current = $state.raw<OfflineSnapshot | null>(null);
	#userId: string | null = null;

	/** Loads the stored copy for this account, if it is theirs. */
	async init(userId: string): Promise<void> {
		this.#userId = userId;
		if (!browser) return;
		const stored = await idb.get<OfflineSnapshot>('kv', KEY).catch(() => undefined);
		this.current = stored && stored.userId === userId ? stored : null;
	}

	/** Fetches a new copy when online and the current one is stale. */
	async refresh(force = false): Promise<void> {
		if (!browser || !this.#userId || !connectivity.online) return;
		const age = this.current ? Date.now() - Date.parse(this.current.generatedAt) : Infinity;
		if (!force && age < FRESH_MS) return;
		try {
			const response = await fetch('/api/offline/snapshot');
			if (!response.ok) return;
			const snapshot = (await response.json()) as OfflineSnapshot;
			if (snapshot.userId !== this.#userId) return;
			await idb.put('kv', snapshot, KEY);
			this.current = snapshot;
		} catch {
			// Offline after all: the stored copy stays in use.
		}
	}

	planFor(sessionId: string): SessionPlan | null {
		return this.current?.plans[sessionId] ?? null;
	}

	forget(): void {
		this.current = null;
		this.#userId = null;
	}
}

export const snapshot = new SnapshotStore();
