<script lang="ts">
	import type { Measure, MeasureType } from '$domain/models/common.ts';
	import { formatClock } from '$domain/models/common.ts';
	import NumberStepper from '$components/ui/NumberStepper.svelte';
	import SegmentedControl from '$components/ui/SegmentedControl.svelte';

	/**
	 * The one editor for "how much" — used for an exercise's default and for
	 * every item in a session, so the three measure kinds behave the same
	 * wherever they appear.
	 */
	interface Props {
		measure: Measure;
		compact?: boolean;
		id?: string;
	}

	let { measure = $bindable(), compact = false, id }: Props = $props();

	const SEGMENTS = [
		{ value: 'reps' as const, label: 'Reps' },
		{ value: 'time' as const, label: 'Time' },
		{ value: 'distance' as const, label: 'Distance' }
	];

	/** Sensible starting point when switching kind, rather than carrying 30 reps into 30 metres. */
	const DEFAULT_VALUE: Record<MeasureType, number> = { reps: 10, time: 30, distance: 400 };
	const STEP: Record<MeasureType, number> = { reps: 1, time: 5, distance: 50 };
	const MAX: Record<MeasureType, number> = { reps: 10_000, time: 86_400, distance: 1_000_000 };
	const SUFFIX: Record<MeasureType, string> = { reps: 'reps', time: 'sec', distance: 'm' };

	let type = $state<MeasureType>(measure.type);

	function changeType(next: MeasureType) {
		if (next === measure.type) return;
		measure = { type: next, value: DEFAULT_VALUE[next] } as Measure;
	}

	$effect(() => {
		if (type !== measure.type) changeType(type);
	});

	// Keep the segmented control honest if the measure is replaced from outside.
	$effect(() => {
		type = measure.type;
	});
</script>

<div class="flex flex-col gap-2 {compact ? '' : 'sm:flex-row sm:items-center'}">
	<SegmentedControl bind:value={type} segments={SEGMENTS} size="sm" class="w-full sm:w-auto" />
	<div class="flex items-center gap-2">
		<NumberStepper
			{id}
			bind:value={measure.value}
			min={1}
			max={MAX[measure.type]}
			step={STEP[measure.type]}
			suffix={SUFFIX[measure.type]}
			ariaLabel="Amount"
			class="w-40"
		/>
		{#if measure.type === 'time'}
			<span class="text-ink-subtle tabular text-xs">{formatClock(measure.value)}</span>
		{/if}
	</div>
</div>
