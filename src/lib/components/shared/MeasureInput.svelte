<script lang="ts">
	import type { Measure, MeasureType } from '$domain/models/common.ts';
	import DurationInput from '$components/ui/DurationInput.svelte';
	import NumberStepper from '$components/ui/NumberStepper.svelte';
	import SegmentedControl from '$components/ui/SegmentedControl.svelte';

	/**
	 * The one editor for "how much" — used for an exercise's default and for
	 * every item in a session, so the three measure kinds behave the same
	 * wherever they appear.
	 *
	 * A time is entered as hours, minutes and seconds, each with its own + and −,
	 * and always stored in seconds.
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
	const STEP: Record<Exclude<MeasureType, 'time'>, number> = { reps: 1, distance: 50 };
	const MAX: Record<Exclude<MeasureType, 'time'>, number> = { reps: 10_000, distance: 1_000_000 };
	const SUFFIX: Record<Exclude<MeasureType, 'time'>, string> = { reps: 'reps', distance: 'm' };

	/** The schema's ceiling for a timed measure: one day, in seconds. */
	const MAX_TIME_SEC = 86_400;

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
	{#if measure.type === 'time'}
		<DurationInput {id} bind:value={measure.value} min={1} max={MAX_TIME_SEC} />
	{:else}
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
	{/if}
</div>
