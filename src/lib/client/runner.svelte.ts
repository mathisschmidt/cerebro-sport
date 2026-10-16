import type { PlanStep, SessionPlan } from '$domain/models/plan.ts';
import type { WorkoutStepLogInput } from '$domain/models/workout.ts';
import { api } from './api.ts';
import { sound } from './sound.svelte.ts';

/**
 * Drives one workout.
 *
 * Two rules shape everything here:
 *  - Time is measured from timestamps, never accumulated from ticks, so a
 *    backgrounded phone tab does not lose seconds.
 *  - Every finished step is posted immediately, and a failed post is retried
 *    rather than dropped. A session interrupted by a dead battery keeps
 *    everything up to that point.
 */

export type RunnerPhase = 'running' | 'paused' | 'finished';

const TICK_MS = 100;

export class WorkoutRunner {
	readonly workoutId: string;
	readonly plan: SessionPlan;

	index = $state(0);
	phase = $state<RunnerPhase>('running');
	/** Seconds added to the current rest by the athlete. */
	bonusSec = $state(0);
	/** Reps actually done, when they differ from the plan. */
	actualOverride = $state<number | null>(null);
	finishing = $state(false);

	/**
	 * Step indexes done rather than skipped, mirroring the server's upsert: a
	 * step re-run after `back()` replaces its log, so a later skip un-records it.
	 */
	#recorded = new Set<number>();
	/** How many steps are done — whether leaving now has anything worth keeping. */
	recordedCount = $state(0);

	#now = $state(Date.now());
	#stepStartedAt = $state(Date.now());
	#pausedAt: number | null = null;
	#pausedMs = $state(0);
	/**
	 * Time logged per step index, pauses already taken out. Keyed like the
	 * server's upsert, so a step re-run after `back()` replaces its time.
	 */
	#loggedMs = $state<Record<number, number>>({});
	#stepStartedIso = new Date().toISOString();

	#timer: ReturnType<typeof setInterval> | null = null;
	#wakeLock: WakeLockSentinel | null = null;
	/** Step logs whose POST failed, retried on the next step and at finish. */
	#pending: WorkoutStepLogInput[] = [];

	/** A run always starts at its first step — it is never resumed. */
	constructor(workoutId: string, plan: SessionPlan) {
		this.workoutId = workoutId;
		this.plan = plan;
	}

	get step(): PlanStep | undefined {
		return this.plan.steps[this.index];
	}

	get nextStep(): PlanStep | undefined {
		return this.plan.steps[this.index + 1];
	}

	get isLast(): boolean {
		return this.index >= this.plan.steps.length - 1;
	}

	/** Milliseconds spent on the current step, excluding paused time. */
	get stepElapsedMs(): number {
		const pausedNow = this.#pausedAt === null ? 0 : this.#now - this.#pausedAt;
		return Math.max(0, this.#now - this.#stepStartedAt - this.#pausedMs - pausedNow);
	}

	/**
	 * Training time so far: every logged step plus the one under way, pauses
	 * excluded. The same sum the server derives from the step logs, so the
	 * header, the summary and the metrics all show one number.
	 */
	get totalElapsedMs(): number {
		const logged = Object.values(this.#loggedMs).reduce((sum, ms) => sum + ms, 0);
		return logged + (this.phase === 'finished' ? 0 : this.stepElapsedMs);
	}

	/** Planned length of the current step in ms, or 0 when it is self-paced. */
	get targetMs(): number {
		const step = this.step;
		if (!step) return 0;
		if (step.kind === 'rest') return ((step.restSec ?? 0) + this.bonusSec) * 1000;
		if (step.measure?.type === 'time') return step.measure.value * 1000;
		return 0;
	}

	get isCountdown(): boolean {
		return this.targetMs > 0;
	}

	get remainingMs(): number {
		return Math.max(0, this.targetMs - this.stepElapsedMs);
	}

	/** 0–1 through the current step; self-paced steps report 0. */
	get stepProgress(): number {
		if (!this.isCountdown) return 0;
		return Math.min(1, this.stepElapsedMs / this.targetMs);
	}

	get overallProgress(): number {
		return this.plan.steps.length === 0 ? 0 : this.index / this.plan.steps.length;
	}

	start(): void {
		this.#stepStartedAt = Date.now();
		this.#stepStartedIso = new Date().toISOString();
		this.#tick();
		this.#timer = setInterval(() => this.#tick(), TICK_MS);
		void this.#acquireWakeLock();
	}

	destroy(): void {
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = null;
		void this.#wakeLock?.release().catch(() => {});
		this.#wakeLock = null;
	}

	#tick(): void {
		this.#now = Date.now();
		if (this.phase !== 'running') return;
		if (this.isCountdown && this.remainingMs === 0) {
			this.complete();
		}
	}

	togglePause(): void {
		if (this.phase === 'running') {
			this.phase = 'paused';
			this.#pausedAt = Date.now();
		} else if (this.phase === 'paused') {
			if (this.#pausedAt !== null) this.#pausedMs += Date.now() - this.#pausedAt;
			this.#pausedAt = null;
			this.phase = 'running';
		}
	}

	addSeconds(seconds: number): void {
		this.bonusSec = Math.max(0, this.bonusSec + seconds);
	}

	/** Finishes the current step and moves on. */
	complete(options: { skipped?: boolean } = {}): void {
		const step = this.step;
		if (!step || this.phase === 'finished') return;

		const durationMs = this.stepElapsedMs;
		this.#loggedMs[step.index] = durationMs;
		if (options.skipped) this.#recorded.delete(step.index);
		else this.#recorded.add(step.index);
		this.recordedCount = this.#recorded.size;
		this.#enqueue({
			stepIndex: step.index,
			stepKey: step.key,
			kind: step.kind,
			blockId: step.blockId,
			blockIndex: step.blockIndex,
			itemId: step.itemId,
			itemIndex: step.itemIndex,
			roundIndex: step.roundIndex,
			exerciseId: step.exerciseId,
			exerciseName: step.exerciseName,
			plannedMeasure: step.measure,
			plannedRestSec: step.kind === 'rest' ? (step.restSec ?? 0) + this.bonusSec : null,
			actualValue: this.#actualValue(step, durationMs),
			durationMs,
			skipped: options.skipped ?? false,
			startedAt: this.#stepStartedIso,
			completedAt: new Date().toISOString()
		});

		this.#cue(options.skipped ? 'skip' : 'done');

		if (this.isLast) {
			this.phase = 'finished';
			return;
		}
		this.index += 1;
		this.#resetStep();
	}

	skip(): void {
		this.complete({ skipped: true });
	}

	/** Steps back without deleting the log already written for that step. */
	back(): void {
		if (this.index === 0) return;
		this.index -= 1;
		this.#resetStep();
		if (this.phase === 'finished') this.phase = 'running';
	}

	#resetStep(): void {
		this.#stepStartedAt = Date.now();
		this.#stepStartedIso = new Date().toISOString();
		this.#pausedMs = 0;
		this.#pausedAt = this.phase === 'paused' ? Date.now() : null;
		this.bonusSec = 0;
		this.actualOverride = null;
	}

	#actualValue(step: PlanStep, durationMs: number): number | null {
		if (step.kind === 'rest') return Math.round(durationMs / 1000);
		if (this.actualOverride !== null) return this.actualOverride;
		if (!step.measure) return null;
		// A timed effort records the seconds actually held, which can differ from
		// the plan when the athlete stops early.
		return step.measure.type === 'time' ? Math.round(durationMs / 1000) : step.measure.value;
	}

	#enqueue(log: WorkoutStepLogInput): void {
		this.#pending.push(log);
		void this.flush();
	}

	/** Posts everything queued; anything that fails stays queued for the next try. */
	async flush(): Promise<void> {
		const queue = [...this.#pending];
		this.#pending = [];
		for (const log of queue) {
			try {
				await api.workouts.logStep(this.workoutId, log);
			} catch {
				this.#pending.push(log);
			}
		}
	}

	async finish(status: 'completed' | 'abandoned', notes = ''): Promise<void> {
		this.finishing = true;
		try {
			await this.flush();
			await api.workouts.finish(this.workoutId, { status, notes });
		} finally {
			this.finishing = false;
		}
	}

	/**
	 * Reports the ending when the page is going away — a closed tab or a reload —
	 * where a normal request would be cancelled. Beacons are fire-and-forget, so
	 * the server's `finish` is idempotent and the run page closes any run it
	 * finds left half-way. On the summary screen the run is complete; anywhere
	 * else it was left.
	 */
	endOnUnload(): void {
		const status = this.phase === 'finished' ? 'completed' : 'abandoned';
		const send = (path: string, body: unknown) =>
			navigator.sendBeacon?.(
				`/api/workouts/${this.workoutId}/${path}`,
				new Blob([JSON.stringify(body)], { type: 'application/json' })
			);
		for (const log of this.#pending) send('steps', log);
		this.#pending = [];
		send('finish', { status, notes: '' });
	}

	/**
	 * Leaves without keeping anything. Queued logs are dropped rather than
	 * flushed — they would only be deleted with the workout.
	 */
	async discard(): Promise<void> {
		this.finishing = true;
		try {
			this.#pending = [];
			await api.workouts.remove(this.workoutId);
		} finally {
			this.finishing = false;
		}
	}

	async #acquireWakeLock(): Promise<void> {
		try {
			this.#wakeLock = await navigator.wakeLock?.request('screen');
			// A tab that goes to the background loses the lock; take it back.
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible' && this.phase !== 'finished') {
					void this.#acquireWakeLock();
				}
			});
		} catch {
			// Unsupported or denied — the screen may dim, nothing else breaks.
		}
	}

	/** Short audio + haptic cue so a step change is noticeable without looking. */
	#cue(kind: 'done' | 'skip'): void {
		try {
			navigator.vibrate?.(kind === 'done' ? [40] : [15, 40, 15]);
		} catch {
			// Vibration is a nicety.
		}
		playTone(kind === 'done' ? 880 : 440);
	}
}

let audioContext: AudioContext | null = null;

/**
 * A single short sine blip, at the athlete's chosen volume. Created lazily —
 * browsers block audio before a gesture.
 */
export function playTone(frequency: number, durationMs = 120): void {
	if (sound.muted) return;
	try {
		audioContext ??= new AudioContext();
		if (audioContext.state === 'suspended') void audioContext.resume();
		const oscillator = audioContext.createOscillator();
		const gain = audioContext.createGain();
		oscillator.frequency.value = frequency;
		oscillator.type = 'sine';
		gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
		gain.gain.exponentialRampToValueAtTime(sound.gain, audioContext.currentTime + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + durationMs / 1000);
		oscillator.connect(gain).connect(audioContext.destination);
		oscillator.start();
		oscillator.stop(audioContext.currentTime + durationMs / 1000);
	} catch {
		// No audio available; the visual countdown still carries the change.
	}
}
