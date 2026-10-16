<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { formatClock, formatDuration, formatMeasure } from '$domain/models/common.ts';
	import { planStepLabel } from '$domain/models/plan.ts';
	import { WORKOUT_OUTCOME_LABEL, workoutOutcome } from '$domain/models/workout.ts';
	import { WorkoutRunner, playTone } from '$client/runner.svelte.ts';
	import { sound } from '$client/sound.svelte.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import Button from '$components/ui/Button.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import Modal from '$components/ui/Modal.svelte';
	import NumberStepper from '$components/ui/NumberStepper.svelte';
	import TimerRing from '$components/runner/TimerRing.svelte';
	import RunnerSummary from '$components/runner/RunnerSummary.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();

	// The runner is built once from the loaded workout and then owns the run;
	// a re-created runner mid-session would reset every timer. The load only
	// ever hands over a fresh run — a run is never resumed.
	// svelte-ignore state_referenced_locally
	const runner = new WorkoutRunner(data.workout.id, data.workout.plan);

	let notes = $state('');
	let saving = $state(false);
	let leaveOpen = $state(false);
	let soundOpen = $state(false);

	/** Bound to the slider; every change is stored for this device at once. */
	const volumeProxy = {
		get value(): number {
			return sound.volume;
		},
		set value(next: number) {
			sound.set(next);
		}
	};
	let discarding = $state(false);
	/** Whether opening the leave dialog paused the run, so staying can undo it. */
	let pausedForLeave = false;
	/** Set once the run has been saved or discarded, so navigating away is allowed. */
	let ended = false;

	/** How the run would show if left now — the same scale as everywhere else. */
	const leaveOutcome = $derived(
		WORKOUT_OUTCOME_LABEL[
			workoutOutcome({
				status: 'abandoned',
				completedStepCount: runner.recordedCount,
				plannedStepCount: runner.plan.steps.length
			})
		]
	);

	// Leaving ends the run, so in-app navigation goes through the leave dialog
	// rather than slipping past it. Closing the tab cannot be stopped; that is
	// what `pagehide` is for.
	beforeNavigate((navigation) => {
		if (ended || navigation.type === 'leave') return;
		navigation.cancel();
		// On the summary every step is behind the athlete: leaving is finishing.
		if (runner.phase === 'finished') void save('completed');
		else if (!leaveOpen) openLeave();
	});

	// A closed tab or a reload still ends the run. With nothing done there is
	// nothing to end — the empty run is cleared the next time one starts.
	function onpagehide() {
		if (ended) return;
		if (runner.recordedCount > 0 || runner.phase === 'finished') runner.endOnUnload();
	}

	// Time spent deciding whether to leave is not training time.
	function openLeave() {
		pausedForLeave = runner.phase === 'running';
		if (pausedForLeave) runner.togglePause();
		leaveOpen = true;
	}

	function stay() {
		leaveOpen = false;
		if (pausedForLeave && runner.phase === 'paused') runner.togglePause();
		pausedForLeave = false;
	}
	let showInstructions = $state(false);
	let lastBeepSecond = -1;

	const step = $derived(runner.step);
	const next = $derived(runner.nextStep);
	const isRest = $derived(step?.kind === 'rest');
	const selfPaced = $derived(step?.kind === 'exercise' && step.measure?.type !== 'time');

	/**
	 * Reps actually done. Reads the plan until the athlete changes it, then the
	 * override is what gets logged.
	 */
	const repsDone = {
		get value(): number {
			if (runner.actualOverride !== null) return runner.actualOverride;
			return step?.measure?.type === 'reps' ? step.measure.value : 0;
		},
		set value(next: number) {
			runner.actualOverride = next;
		}
	};

	onMount(() => runner.start());
	onDestroy(() => runner.destroy());

	// Three-two-one before a countdown ends, so the change is never a surprise.
	$effect(() => {
		if (runner.phase !== 'running' || !runner.isCountdown) return;
		const second = Math.ceil(runner.remainingMs / 1000);
		if (second <= 3 && second > 0 && second !== lastBeepSecond) {
			lastBeepSecond = second;
			playTone(660, 80);
		}
		if (second > 3) lastBeepSecond = -1;
	});

	function onkeydown(event: KeyboardEvent) {
		if (leaveOpen || soundOpen) return;
		if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
		if (event.key === ' ') {
			event.preventDefault();
			if (runner.phase === 'finished') return;
			// Paused, space only ever resumes — it must not finish a step unseen.
			if (runner.phase === 'paused' || !selfPaced) runner.togglePause();
			else runner.complete();
			return;
		}
		// Nothing behind the pause screen moves until the athlete is back.
		if (runner.phase === 'paused') return;
		if (event.key === 'ArrowRight') runner.skip();
		if (event.key === 'ArrowLeft') runner.back();
	}

	async function save(status: 'completed' | 'abandoned') {
		if (saving) return;
		saving = true;
		try {
			await runner.finish(status, notes.trim());
			ended = true;
			toasts.success(status === 'completed' ? 'Session saved' : 'Saved — it counts in your metrics');
			await goto('/', { invalidateAll: true });
		} catch {
			toasts.error('Could not save — check your connection and try again');
		} finally {
			saving = false;
		}
	}

	async function discard() {
		discarding = true;
		try {
			await runner.discard();
			ended = true;
			toasts.success('Session discarded');
			await goto('/', { invalidateAll: true });
		} catch {
			toasts.error('Could not discard — check your connection and try again');
		} finally {
			discarding = false;
		}
	}
</script>

<svelte:window {onkeydown} {onpagehide} />
<svelte:head><title>{data.workout.sessionName} — running</title></svelte:head>

<div class="bg-bg text-ink flex min-h-[100dvh] flex-col">
	{#if runner.phase === 'finished'}
		<RunnerSummary
			plan={runner.plan}
			totalMs={runner.totalElapsedMs}
			completedSteps={runner.recordedCount}
			bind:notes
			{saving}
			onsave={() => save('completed')}
		/>
	{:else if step}
		<!-- Header -->
		<header class="pt-safe px-4 pt-3">
			<div class="flex items-center gap-3">
				<button
					type="button"
					class="text-ink-subtle hover:text-ink -ml-2 grid size-10 shrink-0 place-items-center rounded-lg"
					onclick={openLeave}
					aria-label="Leave the session"
				>
					<Icon name="close" size={20} />
				</button>
				<div class="min-w-0 flex-1 text-center">
					<p class="text-ink truncate text-[13px] font-medium">{data.workout.sessionName}</p>
					<p class="text-ink-subtle tabular text-[11px]">
						Step {runner.index + 1} of {runner.plan.steps.length} · {formatDuration(
							runner.totalElapsedMs
						)}
					</p>
				</div>
				<button
					type="button"
					class="text-ink-subtle hover:text-ink grid size-10 shrink-0 place-items-center rounded-lg"
					onclick={() => (soundOpen = true)}
					aria-label="Timer sound, {sound.muted ? 'muted' : `${sound.volume}%`}"
				>
					<Icon name={sound.muted ? 'volumeOff' : 'volume'} size={20} />
				</button>
				<button
					type="button"
					class="text-ink-subtle hover:text-ink -mr-2 grid size-10 shrink-0 place-items-center rounded-lg"
					onclick={() => runner.togglePause()}
					aria-label={runner.phase === 'paused' ? 'Resume' : 'Pause'}
				>
					<Icon name={runner.phase === 'paused' ? 'play' : 'pause'} size={20} />
				</button>
			</div>

			<div class="bg-surface-sunken mt-3 h-1 w-full overflow-hidden rounded-full">
				<div
					class="bg-accent h-full rounded-full transition-[width] duration-300"
					style="width:{runner.overallProgress * 100}%"
				></div>
			</div>
		</header>

		<!-- Current step -->
		<main class="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-5 py-6">
			<div class="text-center">
				<p class="text-ink-subtle text-[11px] font-medium tracking-wide uppercase">
					{step.blockLabel}
					{#if step.roundCount > 1}
						· Round {step.roundIndex}/{step.roundCount}
					{/if}
				</p>
				<h1
					class="mt-1.5 text-[clamp(1.5rem,7vw,2.25rem)] leading-tight font-semibold"
					style="color:{isRest ? 'var(--app-info)' : 'var(--app-text)'}"
				>
					{planStepLabel(step)}
				</h1>
				{#if step.targetLoad}
					<p class="text-accent mt-1 text-sm font-medium">{step.targetLoad}</p>
				{/if}
			</div>

			{#if runner.isCountdown}
				<TimerRing
					progress={runner.stepProgress}
					remainingMs={runner.remainingMs}
					tone={isRest ? 'info' : 'accent'}
					label={isRest ? 'Rest' : 'Hold'}
				/>
			{:else if step.measure}
				<!-- Self-paced: the target is the headline, the elapsed clock is secondary -->
				<div class="flex flex-col items-center gap-2">
					<p class="text-accent text-[clamp(3.5rem,20vw,6rem)] leading-none font-semibold">
						{step.measure.value}
					</p>
					<p class="text-ink-muted text-sm">
						{step.measure.type === 'distance' ? 'metres' : 'reps'}
					</p>
					<p class="text-ink-subtle tabular mt-1 text-[13px]">
						{formatClock(runner.stepElapsedMs / 1000)} elapsed
					</p>
				</div>
			{/if}

			{#if step.notes}
				<p class="text-ink-muted max-w-sm text-center text-[13px]">{step.notes}</p>
			{/if}

			{#if step.exerciseInstructions}
				<div class="w-full max-w-sm">
					<button
						type="button"
						class="text-ink-subtle hover:text-ink mx-auto flex items-center gap-1 text-[12px]"
						onclick={() => (showInstructions = !showInstructions)}
						aria-expanded={showInstructions}
					>
						<Icon name={showInstructions ? 'chevronUp' : 'chevronDown'} size={13} />
						{showInstructions ? 'Hide' : 'How to do it'}
					</button>
					{#if showInstructions}
						<p
							class="border-line text-ink-muted mt-2 rounded-xl border p-3 text-[13px] leading-relaxed whitespace-pre-line"
						>
							{step.exerciseInstructions}
						</p>
					{/if}
				</div>
			{/if}

		</main>

		<!-- Actions: everything here is thumb-reachable -->
		<footer class="pb-safe border-line border-t px-4 pt-3">
			{#if next}
				<p class="text-ink-subtle mb-2.5 truncate text-center text-[12px]">
					Up next: <span class="text-ink-muted">{planStepLabel(next)}</span>
					{#if next.measure}· {formatMeasure(next.measure)}{:else if next.restSec}· {next.restSec}s{/if}
				</p>
			{/if}

			{#if isRest}
				<div class="flex gap-2">
					<Button variant="secondary" size="lg" onclick={() => runner.addSeconds(15)}>+15s</Button>
					<Button variant="primary" size="lg" full onclick={() => runner.complete()}>
						Skip rest
					</Button>
				</div>
			{:else if selfPaced}
				<div class="flex flex-col gap-2">
					{#if step.measure && step.measure.type === 'reps'}
						<div class="flex items-center justify-center gap-2">
							<span class="text-ink-subtle text-[12px]">Did a different number?</span>
							<NumberStepper
								bind:value={repsDone.value}
								min={0}
								max={10000}
								ariaLabel="Reps actually completed"
								class="w-32"
							/>
						</div>
					{/if}
					<Button variant="primary" size="lg" full icon="check" onclick={() => runner.complete()}>
						Done
					</Button>
				</div>
			{:else}
				<Button variant="primary" size="lg" full onclick={() => runner.complete()}>
					Finish early
				</Button>
			{/if}

			<div class="mt-2 flex items-center justify-between">
				<Button variant="ghost" size="sm" icon="chevronLeft" onclick={() => runner.back()}>
					Back
				</Button>
				<Button variant="ghost" size="sm" iconRight="skip" onclick={() => runner.skip()}>
					Skip step
				</Button>
			</div>
		</footer>
	{/if}
</div>

<!--
	A pause is an interruption, not training: the clock stops and none of it
	counts. Everything behind is blurred and out of reach, so the only way back
	is the button under the message.
-->
{#if runner.phase === 'paused'}
	<div
		class="bg-bg/70 fixed inset-0 z-40 flex flex-col items-center justify-center gap-5 px-6 backdrop-blur-md"
		role="dialog"
		aria-modal="true"
		aria-labelledby="paused-title"
	>
		<span class="bg-surface-raised border-line text-warning grid size-16 place-items-center rounded-2xl border">
			<Icon name="pause" size={30} />
		</span>
		<div class="text-center">
			<h2 id="paused-title" class="text-ink text-3xl font-semibold">Paused</h2>
			<p class="text-ink-muted mt-1.5 text-sm">The clock is stopped — this time does not count.</p>
		</div>
		<Button variant="primary" size="lg" icon="play" class="w-full max-w-xs" onclick={() => runner.togglePause()}>
			Continue
		</Button>
	</div>
{/if}

<!--
	The countdown beeps and step tones, at a level kept on this device. The run
	keeps going underneath, so the next real beep is a test too.
-->
<Modal bind:open={soundOpen} title="Timer sound" size="sm">
	<div class="flex flex-col gap-4">
		<div class="flex items-center gap-3">
			<button
				type="button"
				class="text-ink-muted hover:text-ink grid size-10 shrink-0 place-items-center rounded-lg border border-line"
				onclick={() => sound.toggleMute()}
				aria-label={sound.muted ? 'Unmute' : 'Mute'}
			>
				<Icon name={sound.muted ? 'volumeOff' : 'volume'} size={18} />
			</button>
			<input
				type="range"
				min="0"
				max="100"
				step="5"
				bind:value={volumeProxy.value}
				onchange={() => playTone(660, 80)}
				class="accent-accent h-10 min-w-0 flex-1"
				aria-label="Volume"
			/>
			<span class="text-ink tabular w-11 shrink-0 text-right text-sm font-medium">
				{sound.muted ? 'Off' : `${sound.volume}%`}
			</span>
		</div>
		<p class="text-ink-subtle text-[13px] leading-relaxed">
			The beeps in the last seconds of a countdown and the tone when a step ends. Saved on this
			device.
		</p>
	</div>
	{#snippet footer()}
		<Button variant="ghost" icon="play" onclick={() => playTone(660, 80)} disabled={sound.muted}>
			Test
		</Button>
		<Button variant="primary" onclick={() => (soundOpen = false)}>Done</Button>
	{/snippet}
</Modal>

<!--
	Leaving ends the run — there is no resuming it — so this asks what to do with
	what was done. Saved, it is kept with its outcome; discarded, it is deleted.
	With nothing done yet there is nothing to save, so the choice is only whether
	to leave.
-->
<Modal bind:open={leaveOpen} title="Leave this session?" size="sm" onclose={stay}>
	{#if runner.recordedCount > 0}
		<p class="text-ink-muted text-sm leading-relaxed">
			You have done {runner.recordedCount} of {runner.plan.steps.length} steps. Leaving ends this
			run — it cannot be picked up again. Save it and it is kept as
			<strong class="text-ink font-medium">{leaveOutcome}</strong>: it counts in your volume and
			calendar, but not in this session's time stats, which only use fully completed runs. Discard
			it and it is deleted.
		</p>
	{:else}
		<p class="text-ink-muted text-sm leading-relaxed">
			No step is done yet, so there is nothing to save. Leaving discards this run.
		</p>
	{/if}
	{#snippet footer()}
		<Button variant="ghost" onclick={stay}>Keep going</Button>
		<Button variant="danger" loading={discarding} disabled={saving} onclick={discard}>
			{runner.recordedCount > 0 ? 'Discard' : 'Leave'}
		</Button>
		{#if runner.recordedCount > 0}
			<Button variant="primary" loading={saving} disabled={discarding} onclick={() => save('abandoned')}>
				Save & leave
			</Button>
		{/if}
	{/snippet}
</Modal>
