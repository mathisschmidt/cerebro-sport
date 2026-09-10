<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { formatClock, formatDuration, formatMeasure } from '$domain/models/common.ts';
	import { planStepLabel } from '$domain/models/plan.ts';
	import { WorkoutRunner, playTone } from '$client/runner.svelte.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import Button from '$components/ui/Button.svelte';
	import ConfirmDialog from '$components/ui/ConfirmDialog.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import NumberStepper from '$components/ui/NumberStepper.svelte';
	import TimerRing from '$components/runner/TimerRing.svelte';
	import RunnerSummary from '$components/runner/RunnerSummary.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();

	// The runner is built once from the loaded workout and then owns the run;
	// a re-created runner mid-session would reset every timer. Reopening an
	// interrupted workout resumes at the first unlogged step.
	// svelte-ignore state_referenced_locally
	const runner = new WorkoutRunner(data.workout.id, data.workout.plan, data.workout.startedAt, {
		startIndex: WorkoutRunner.resumeIndexFrom(
			data.workout.plan,
			data.workout.steps.map((log) => log.stepIndex)
		)
	});
	// svelte-ignore state_referenced_locally
	runner.seedMeasured(
		data.workout.steps.reduce((sum, log) => sum + (log.skipped ? 0 : log.durationMs), 0)
	);

	let notes = $state('');
	let saving = $state(false);
	let abandonOpen = $state(false);
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
		if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
		if (event.key === ' ') {
			event.preventDefault();
			if (runner.phase === 'finished') return;
			selfPaced ? runner.complete() : runner.togglePause();
		}
		if (event.key === 'ArrowRight') runner.skip();
		if (event.key === 'ArrowLeft') runner.back();
	}

	async function save(status: 'completed' | 'abandoned') {
		saving = true;
		try {
			await runner.finish(status, notes.trim());
			toasts.success(status === 'completed' ? 'Session saved' : 'Session closed');
			await goto('/', { invalidateAll: true });
		} catch {
			toasts.error('Could not save — check your connection and try again');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window {onkeydown} />
<svelte:head><title>{data.workout.sessionName} — running</title></svelte:head>

<div class="bg-bg text-ink flex min-h-[100dvh] flex-col">
	{#if runner.phase === 'finished'}
		<RunnerSummary
			plan={runner.plan}
			totalMs={runner.measuredMs}
			completedSteps={runner.index + 1}
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
					onclick={() => (abandonOpen = true)}
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

			{#if runner.phase === 'paused'}
				<p class="text-warning text-[13px] font-medium">Paused</p>
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

<ConfirmDialog
	bind:open={abandonOpen}
	title="Leave this session?"
	message="Everything you have already done is saved. The session will be marked as abandoned."
	confirmLabel="Leave"
	danger
	onconfirm={() => save('abandoned')}
/>
