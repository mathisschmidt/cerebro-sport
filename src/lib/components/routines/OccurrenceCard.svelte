<script lang="ts">
	import type { RoutineOccurrence } from '$domain/models/routine.ts';
	import { formatClock } from '$domain/models/common.ts';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Icon from '$components/ui/Icon.svelte';

	interface Props {
		occurrence: RoutineOccurrence;
		busy?: boolean;
		onstart: () => void;
		onresolve: (status: 'completed' | 'skipped' | 'pending') => void;
	}

	let { occurrence, busy = false, onstart, onresolve }: Props = $props();

	const done = $derived(occurrence.status === 'completed');
	const skipped = $derived(occurrence.status === 'skipped');
	const settled = $derived(done || skipped);
</script>

<article
	class="card flex items-center gap-3 p-3.5 sm:p-4 {settled ? 'opacity-60' : ''}"
>
	<button
		type="button"
		class="grid size-10 shrink-0 place-items-center rounded-xl border transition-colors
		{done
			? 'border-accent bg-accent text-accent-ink'
			: skipped
				? 'border-line bg-surface-sunken text-ink-subtle'
				: 'border-line-strong text-ink-subtle hover:border-accent hover:text-accent'}"
		onclick={() => onresolve(done ? 'pending' : 'completed')}
		disabled={busy}
		aria-label={done ? 'Mark as not done' : 'Mark as done'}
	>
		<Icon name={skipped ? 'close' : 'check'} size={20} />
	</button>

	<div class="min-w-0 flex-1">
		<div class="flex flex-wrap items-center gap-2">
			<h3 class="text-ink text-sm font-semibold {settled ? 'line-through' : ''}">
				{occurrence.routineName}
			</h3>
			{#if occurrence.timeOfDay}
				<Badge>{occurrence.timeOfDay}</Badge>
			{/if}
			{#if skipped}<Badge tone="warning">Skipped</Badge>{/if}
		</div>
		<p class="text-ink-subtle mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px]">
			<span class="inline-flex items-center gap-1">
				<Icon name="layers" size={11} />
				{occurrence.sessionName}
			</span>
			{#if occurrence.estimatedDurationSec > 0}
				<span class="inline-flex items-center gap-1">
					<Icon name="clock" size={11} />
					{formatClock(occurrence.estimatedDurationSec)}
				</span>
			{/if}
		</p>
	</div>

	<div class="flex shrink-0 items-center gap-1">
		{#if !settled}
			<button
				type="button"
				class="text-ink-subtle hover:text-ink hover:bg-surface-sunken grid size-9 place-items-center rounded-lg transition-colors"
				onclick={() => onresolve('skipped')}
				disabled={busy}
				aria-label="Skip today"
			>
				<Icon name="skip" size={16} />
			</button>
			<Button variant="primary" size="sm" icon="play" onclick={onstart} disabled={busy}>Start</Button>
		{:else if occurrence.workoutId}
			<Button variant="ghost" size="sm" href="/library/sessions/{occurrence.sessionId}">History</Button>
		{:else}
			<Button variant="ghost" size="sm" onclick={() => onresolve('pending')} disabled={busy}>
				Undo
			</Button>
		{/if}
	</div>
</article>
