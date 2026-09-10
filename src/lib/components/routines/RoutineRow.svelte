<script lang="ts">
	import type { RoutineDetail } from '$domain/models/routine.ts';
	import { describeRecurrence } from '$domain/models/routine.ts';
	import { formatClock } from '$domain/models/common.ts';
	import { formatDateLabel, todayIso } from '$domain/services/date.ts';
	import { nextOccurrence } from '$domain/services/recurrence.ts';
	import Badge from '$components/ui/Badge.svelte';
	import Icon from '$components/ui/Icon.svelte';

	interface Props {
		routine: RoutineDetail;
		onedit: () => void;
		ondelete: () => void;
	}

	let { routine, onedit, ondelete }: Props = $props();

	const next = $derived(nextOccurrence(routine, todayIso()));
</script>

<div class="card flex items-start gap-3 p-3.5 sm:p-4">
	<span
		class="grid size-9 shrink-0 place-items-center rounded-xl {routine.active
			? 'bg-accent-soft text-accent'
			: 'bg-surface-sunken text-ink-subtle'}"
	>
		<Icon name="repeat" size={17} />
	</span>

	<div class="min-w-0 flex-1">
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-ink text-sm font-semibold">{routine.name || routine.sessionName}</span>
			{#if !routine.active}<Badge tone="warning">Paused</Badge>{/if}
		</div>
		<p class="text-ink-muted mt-0.5 text-[13px]">
			{describeRecurrence(routine.recurrence)}
			{#if routine.timeOfDay}· {routine.timeOfDay}{/if}
		</p>
		<p class="text-ink-subtle mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
			<span class="inline-flex items-center gap-1">
				<Icon name="layers" size={11} />
				{routine.sessionName}
			</span>
			{#if routine.estimatedDurationSec > 0}
				<span class="inline-flex items-center gap-1">
					<Icon name="clock" size={11} />
					{formatClock(routine.estimatedDurationSec)}
				</span>
			{/if}
			<span>
				{next ? `Next: ${formatDateLabel(next)}` : 'No upcoming date'}
			</span>
		</p>
	</div>

	<div class="flex shrink-0 items-center gap-0.5">
		<button
			type="button"
			class="text-ink-subtle hover:text-ink hover:bg-surface-sunken grid size-9 place-items-center rounded-lg transition-colors"
			onclick={onedit}
			aria-label="Edit routine"
		>
			<Icon name="pencil" size={16} />
		</button>
		<button
			type="button"
			class="text-ink-subtle hover:text-danger hover:bg-danger/10 grid size-9 place-items-center rounded-lg transition-colors"
			onclick={ondelete}
			aria-label="Delete routine"
		>
			<Icon name="trash" size={16} />
		</button>
	</div>
</div>
