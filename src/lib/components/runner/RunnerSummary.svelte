<script lang="ts">
	import type { SessionPlan } from '$domain/models/plan.ts';
	import { formatDuration } from '$domain/models/common.ts';
	import Button from '$components/ui/Button.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import TextArea from '$components/ui/TextArea.svelte';

	interface Props {
		plan: SessionPlan;
		totalMs: number;
		completedSteps: number;
		notes: string;
		saving: boolean;
		onsave: () => void;
	}

	let {
		plan,
		totalMs,
		completedSteps,
		notes = $bindable(),
		saving,
		onsave
	}: Props = $props();

	const plannedSec = $derived(plan.estimatedDurationSec);
	const actualSec = $derived(Math.round(totalMs / 1000));
	const deltaSec = $derived(actualSec - plannedSec);
</script>

<div class="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-5 py-10 text-center">
	<span class="bg-accent text-accent-ink grid size-16 place-items-center rounded-2xl">
		<Icon name="check" size={32} />
	</span>

	<div>
		<h1 class="text-ink text-2xl font-semibold">Session complete</h1>
		<p class="text-ink-muted mt-1 text-sm">{plan.sessionName}</p>
	</div>

	<div class="grid w-full grid-cols-3 gap-2">
		<div class="card p-3">
			<p class="text-ink-subtle text-[11px]">Total</p>
			<p class="text-ink text-lg font-semibold">{formatDuration(totalMs)}</p>
		</div>
		<div class="card p-3">
			<p class="text-ink-subtle text-[11px]">Steps</p>
			<p class="text-ink text-lg font-semibold">{completedSteps}/{plan.steps.length}</p>
		</div>
		<div class="card p-3">
			<p class="text-ink-subtle text-[11px]">vs plan</p>
			<p
				class="text-lg font-semibold"
				style="color:{deltaSec <= 0 ? 'var(--viz-good)' : 'var(--app-text)'}"
			>
				{deltaSec > 0 ? '+' : ''}{Math.round(deltaSec / 60)}m
			</p>
		</div>
	</div>

	<div class="w-full text-left">
		<label for="workout-notes" class="text-ink-muted mb-1.5 block text-[13px] font-medium">
			How did it go?
		</label>
		<TextArea id="workout-notes" bind:value={notes} rows={3} placeholder="Felt strong on round 3…" />
	</div>

	<Button variant="primary" size="lg" full loading={saving} onclick={onsave}>Save & finish</Button>
</div>
