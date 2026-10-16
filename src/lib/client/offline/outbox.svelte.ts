import { browser } from '$app/environment';
import * as idb from './idb.ts';
import { classifyDelivery, retryDelayMs, type OutboxKind } from './outbox-policy.ts';
import { connectivity } from './connectivity.svelte.ts';

/**
 * Writes waiting for the server, delivered strictly in the order they were
 * made — start, then each step, then the finish. Every run goes through here,
 * online or not, so there is one path to get right: online, the queue simply
 * empties at once.
 *
 * Delivery is attempted when an entry is added, when the app opens, when the
 * connection comes back and when the page is shown again. There is no
 * background sync — iPhones do not support it — so a phone that never reopens
 * the app delivers on its next opening.
 */

export interface OutboxEntry {
	seq?: number;
	/** The account the write belongs to; only its owner ever delivers it. */
	userId: string;
	workoutId: string;
	kind: OutboxKind;
	body: unknown;
	attempts: number;
	/** Why the server refused it for good; set aside, never silently dropped. */
	rejected: string | null;
	createdAt: string;
}

function requestFor(entry: OutboxEntry): { method: string; path: string; body?: unknown } {
	const base = `/api/workouts/${entry.workoutId}`;
	switch (entry.kind) {
		case 'start':
			return { method: 'POST', path: '/api/workouts', body: entry.body };
		case 'step':
			return { method: 'POST', path: `${base}/steps`, body: entry.body };
		case 'finish':
			return { method: 'POST', path: `${base}/finish`, body: entry.body };
		case 'discard':
			return { method: 'DELETE', path: base };
	}
}

/** One attempt. Resolves to the HTTP status and message, or `null` when the server was not reached. */
async function deliver(entry: OutboxEntry): Promise<{ status: number | null; message: string }> {
	const { method, path, body } = requestFor(entry);
	try {
		const response = await fetch(path, {
			method,
			headers: body === undefined ? {} : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		let message = response.statusText;
		if (!response.ok) {
			const payload = (await response.json().catch(() => null)) as {
				error?: { message?: string };
			} | null;
			message = payload?.error?.message ?? message;
		}
		return { status: response.status, message };
	} catch {
		return { status: null, message: 'No connection' };
	}
}

class Outbox {
	/** Runs with writes still to deliver, for the signed-in account. */
	pending = $state(0);
	/** Runs with a write the server refused for good. */
	rejected = $state(0);
	/** The session expired with entries waiting; they go once signed in again. */
	signedOut = $state(false);

	#userId: string | null = null;
	#flushing: Promise<void> | null = null;
	#retryTimer: ReturnType<typeof setTimeout> | null = null;
	/** Told when a flush delivered something, so pages can reload fresh data. */
	#onDelivered = new Set<() => void>();

	constructor() {
		if (!browser) return;
		connectivity.onReconnect(() => this.kick());
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') this.kick();
		});
	}

	setUser(userId: string | null): void {
		this.#userId = userId;
		this.signedOut = false;
		void this.refreshCounts();
	}

	onDelivered(listener: () => void): () => void {
		this.#onDelivered.add(listener);
		return () => this.#onDelivered.delete(listener);
	}

	async entries(): Promise<OutboxEntry[]> {
		const all = await idb.getAll<OutboxEntry>('outbox');
		return all
			.filter((entry) => entry.userId === this.#userId)
			.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
	}

	async refreshCounts(): Promise<void> {
		if (!browser || !this.#userId) {
			this.pending = 0;
			this.rejected = 0;
			return;
		}
		// Counted in runs, not requests: one run of thirty steps is one thing to sync.
		const entries = await this.entries();
		const refused = new Set(entries.filter((entry) => entry.rejected).map((entry) => entry.workoutId));
		const waiting = new Set(
			entries.filter((entry) => !refused.has(entry.workoutId)).map((entry) => entry.workoutId)
		);
		this.rejected = refused.size;
		this.pending = waiting.size;
	}

	/** Fire-and-forget delivery attempt. */
	kick(): void {
		void this.flush();
	}

	/** Delivers everything it can, in order. Concurrent calls share one pass. */
	flush(): Promise<void> {
		this.#flushing ??= this.#flush().finally(() => {
			this.#flushing = null;
		});
		return this.#flushing;
	}

	async #flush(): Promise<void> {
		if (!browser || !this.#userId) return;
		if (this.#retryTimer) clearTimeout(this.#retryTimer);
		this.#retryTimer = null;

		let delivered = false;
		// A workout with a refused entry stops there: what follows depends on it.
		const blocked = new Set<string>();

		for (const entry of await this.entries()) {
			if (entry.rejected) {
				blocked.add(entry.workoutId);
				continue;
			}
			if (blocked.has(entry.workoutId)) continue;

			const { status, message } = await deliver(entry);
			const outcome = classifyDelivery(entry.kind, status);

			if (outcome === 'delivered' || outcome === 'gone') {
				await idb.remove('outbox', entry.seq as number);
				if (entry.kind === 'finish' || entry.kind === 'discard' || outcome === 'gone') {
					await this.#forgetRunIfDone(entry.workoutId);
				}
				delivered = true;
				continue;
			}
			if (outcome === 'signed_out') {
				this.signedOut = true;
				break;
			}
			if (outcome === 'rejected') {
				await idb.put('outbox', { ...entry, rejected: message || `Refused (${status})` });
				blocked.add(entry.workoutId);
				continue;
			}
			// retry: keep the order — nothing after this entry may overtake it.
			const attempts = entry.attempts + 1;
			await idb.put('outbox', { ...entry, attempts });
			this.#retryTimer = setTimeout(() => this.kick(), retryDelayMs(attempts));
			break;
		}

		if (delivered) this.signedOut = false;
		await this.refreshCounts();
		if (delivered) for (const listener of this.#onDelivered) listener();
	}

	/**
	 * A run the server has in full no longer needs its local copy. A run still
	 * under way is never touched — the runner is writing to it.
	 */
	async #forgetRunIfDone(workoutId: string): Promise<void> {
		const run = await idb.get<{ status: string }>('runs', workoutId);
		if (!run || run.status === 'in_progress') return;
		const remaining = (await this.entries()).some((entry) => entry.workoutId === workoutId);
		if (!remaining) await idb.remove('runs', workoutId);
	}
}

export const outbox = new Outbox();
