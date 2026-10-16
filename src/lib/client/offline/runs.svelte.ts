import { browser } from '$app/environment';
import type { SessionPlan } from '$domain/models/plan.ts';
import type {
	WorkoutFinish,
	WorkoutStart,
	WorkoutStatus,
	WorkoutStepLogInput
} from '$domain/models/workout.ts';
import * as idb from './idb.ts';
import type { OutboxEntry } from './outbox.svelte.ts';
import { outbox } from './outbox.svelte.ts';
import { snapshot } from './snapshot.svelte.ts';
import { connectivity } from './connectivity.svelte.ts';

/**
 * Runs are local-first. A run is created on the phone, lives on the phone while
 * it is under way, and reaches the server through the outbox — online or not.
 * Each change to a run and the outbox entry that reports it are written in one
 * transaction, so the two can never disagree.
 *
 * The rules are the server's: a run is never resumed, leaving it ends it, a run
 * left with nothing done is discarded, and starting one ends any still open.
 */

export interface LocalRun {
	id: string;
	userId: string;
	sessionId: string;
	sessionName: string;
	routineId: string | null;
	occurrenceDate: string | null;
	startedAt: string;
	plan: SessionPlan;
	status: WorkoutStatus;
	/** Step logs by step index — re-running a step replaces its log, as on the server. */
	steps: Record<number, WorkoutStepLogInput>;
	completedAt: string | null;
}

/** Steps done, not skipped — the same count the server keeps. */
export function completedStepCount(run: LocalRun): number {
	return Object.values(run.steps).filter((log) => !log.skipped).length;
}

/** How long an online start waits for a fresh plan before using the stored one. */
const PLAN_TIMEOUT_MS = 4_000;

/**
 * The open run page refreshes this every few seconds. A run whose page stopped
 * beating was left — a closed tab, a reload, a dead battery — and is ended the
 * next time the app opens. A second tab sees a live beat and leaves it alone.
 */
const HEARTBEAT_KEY = 'cerebro-sport:active-run';
const HEARTBEAT_STALE_MS = 20_000;

export function beat(runId: string): void {
	try {
		localStorage.setItem(HEARTBEAT_KEY, JSON.stringify({ id: runId, at: Date.now() }));
	} catch {
		// Without storage a second tab may end this run; nothing else breaks.
	}
}

function isBeating(runId: string): boolean {
	try {
		const raw = localStorage.getItem(HEARTBEAT_KEY);
		if (!raw) return false;
		const { id, at } = JSON.parse(raw) as { id: string; at: number };
		return id === runId && Date.now() - at < HEARTBEAT_STALE_MS;
	} catch {
		return false;
	}
}

/** Synchronous, so it holds even from a dying page — the one write `pagehide` can count on. */
export function stopBeat(runId: string): void {
	try {
		const raw = localStorage.getItem(HEARTBEAT_KEY);
		if (raw && (JSON.parse(raw) as { id: string }).id === runId) localStorage.removeItem(HEARTBEAT_KEY);
	} catch {
		// Nothing to clean.
	}
}

function entry(run: LocalRun, kind: OutboxEntry['kind'], body: unknown): OutboxEntry {
	return {
		userId: run.userId,
		workoutId: run.id,
		kind,
		body,
		attempts: 0,
		rejected: null,
		createdAt: new Date().toISOString()
	};
}

/**
 * Writes the run and queues what reports it, in one transaction, then tries to
 * deliver. Values are snapshotted first: IndexedDB cannot clone a reactive
 * proxy, and a plan or a log may have passed through reactive state.
 */
async function commit(run: LocalRun | null, entries: OutboxEntry[]): Promise<void> {
	const plainRun = run ? $state.snapshot(run) : null;
	const plainEntries = entries.map((item) => $state.snapshot(item));
	await idb.transact(['runs', 'outbox'], 'readwrite', async (tx) => {
		if (plainRun) await idb.request(tx, 'runs', (s) => s.put(plainRun));
		for (const item of plainEntries) await idb.request(tx, 'outbox', (s) => s.add(item));
	});
	await outbox.refreshCounts();
	outbox.kick();
}

async function fetchPlan(sessionId: string): Promise<SessionPlan | null> {
	if (!connectivity.online) return null;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PLAN_TIMEOUT_MS);
	try {
		const response = await fetch(`/api/sessions/${sessionId}/plan`, { signal: controller.signal });
		return response.ok ? ((await response.json()) as SessionPlan) : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

export class OfflineUnavailableError extends Error {
	constructor() {
		super('This session is not available offline yet — open the app online once to save it.');
		this.name = 'OfflineUnavailableError';
	}
}

class Runs {
	/** Finished here but not yet all on the server, newest first — shown as "waiting to sync". */
	waiting = $state.raw<LocalRun[]>([]);
	#userId: string | null = null;

	constructor() {
		if (!browser) return;
		// The server has a run once its last entry is delivered; stop listing it.
		outbox.onDelivered(() => void this.refresh());
	}

	setUser(userId: string | null): void {
		this.#userId = userId;
		void this.refresh();
	}

	async refresh(): Promise<void> {
		if (!browser || !this.#userId) {
			this.waiting = [];
			return;
		}
		const runs = await idb.getAll<LocalRun>('runs');
		this.waiting = runs
			.filter((run) => run.userId === this.#userId && run.status !== 'in_progress')
			.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	}

	get(id: string): Promise<LocalRun | undefined> {
		return idb.get<LocalRun>('runs', id);
	}

	/**
	 * Starts a run on this phone. Online, it runs the session as it is right now;
	 * offline, as the stored snapshot has it. Any run still open is ended first.
	 */
	async start(input: { sessionId: string; routineId?: string | null; occurrenceDate?: string | null }): Promise<string> {
		const userId = this.#userId;
		if (!userId) throw new Error('Sign in to start a session');

		const plan = (await fetchPlan(input.sessionId)) ?? snapshot.planFor(input.sessionId);
		if (!plan) throw new OfflineUnavailableError();
		if (plan.steps.length === 0) throw new Error('This session has no steps to run');

		await this.endOpenRuns();

		const run: LocalRun = {
			id: crypto.randomUUID(),
			userId,
			sessionId: input.sessionId,
			sessionName: plan.sessionName,
			routineId: input.routineId ?? null,
			occurrenceDate: input.occurrenceDate ?? null,
			startedAt: new Date().toISOString(),
			plan,
			status: 'in_progress',
			steps: {},
			completedAt: null
		};
		const start: WorkoutStart = {
			id: run.id,
			sessionId: run.sessionId,
			routineId: run.routineId,
			occurrenceDate: run.occurrenceDate,
			startedAt: run.startedAt,
			plan
		};
		await commit(run, [entry(run, 'start', start)]);
		beat(run.id);
		return run.id;
	}

	async recordStep(runId: string, log: WorkoutStepLogInput): Promise<void> {
		const run = await this.get(runId);
		if (!run) return;
		run.steps[log.stepIndex] = log;
		await commit(run, [entry(run, 'step', log)]);
	}

	/**
	 * Ends a run, kept. Left with nothing done, there is nothing to keep, so it
	 * is discarded instead — the same rule the server applies.
	 */
	async finish(runId: string, status: 'completed' | 'abandoned', notes = ''): Promise<void> {
		const run = await this.get(runId);
		if (!run || run.status !== 'in_progress') return;
		if (status === 'abandoned' && completedStepCount(run) === 0) return this.discard(runId);

		run.status = status;
		run.completedAt = new Date().toISOString();
		const body: WorkoutFinish = { status, notes, completedAt: run.completedAt };
		await commit(run, [entry(run, 'finish', body)]);
		stopBeat(runId);
		await this.refresh();
	}

	leave(runId: string): Promise<void> {
		return this.finish(runId, 'abandoned');
	}

	/**
	 * Deletes a run. If the server never heard of it, nothing is sent at all —
	 * its queued writes are simply dropped.
	 */
	async discard(runId: string): Promise<void> {
		const run = await this.get(runId);
		if (!run) return;
		const queued = (await outbox.entries()).filter((item) => item.workoutId === runId);
		const startStillQueued = queued.some((item) => item.kind === 'start' && !item.rejected);

		await idb.transact(['runs', 'outbox'], 'readwrite', async (tx) => {
			await idb.request(tx, 'runs', (s) => s.delete(runId));
			for (const item of queued) await idb.request(tx, 'outbox', (s) => s.delete(item.seq as number));
			if (!startStillQueued) {
				await idb.request(tx, 'outbox', (s) => s.add($state.snapshot(entry(run, 'discard', null))));
			}
		});
		stopBeat(runId);
		await outbox.refreshCounts();
		outbox.kick();
		await this.refresh();
	}

	/** Ends every run still open on this phone — before a new start, and on opening the app. */
	async endOpenRuns(options: { exceptBeating?: boolean } = {}): Promise<void> {
		if (!this.#userId) return;
		const runs = await idb.getAll<LocalRun>('runs');
		for (const run of runs) {
			if (run.userId !== this.#userId || run.status !== 'in_progress') continue;
			if (options.exceptBeating && isBeating(run.id)) continue;
			await this.leave(run.id);
		}
	}
}

export const runs = new Runs();
