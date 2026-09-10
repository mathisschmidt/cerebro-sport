<script lang="ts">
	import type { SessionMetrics } from '$domain/models/metrics.ts';
	import { formatDuration } from '$domain/models/common.ts';
	import { formatDateLabel } from '$domain/services/date.ts';
	import Card from '$components/ui/Card.svelte';
	import Stat from '$components/ui/Stat.svelte';
	import LineChart from '$components/charts/LineChart.svelte';
	import TrendPill from '$components/charts/TrendPill.svelte';
	import StepProgressTable from './StepProgressTable.svelte';

	interface Props {
		metrics: SessionMetrics;
		showSteps?: boolean;
	}

	let { metrics, showSteps = true }: Props = $props();

	const points = $derived(
		metrics.history.map((point) => ({
			label: formatDateLabel(point.date),
			value: point.totalMs,
			caption: `${Math.round(point.completionRate * 100)}% of steps · ${formatDuration(point.activeMs)} active`
		}))
	);
</script>

<div class="flex flex-col gap-4">
	<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
		<Stat label="Runs" value={String(metrics.runCount)} caption="completed" icon="history" />
		<Stat
			label="Last time"
			value={formatDuration(metrics.duration.latest)}
			icon="clock"
		>
			{#snippet trend()}
				<TrendPill trend={metrics.trend} deltaPct={metrics.deltaPct} />
			{/snippet}
		</Stat>
		<Stat
			label="Best"
			value={formatDuration(metrics.duration.best)}
			caption="fastest run"
			icon="zap"
			accent
		/>
		<Stat
			label="Average"
			value={formatDuration(metrics.duration.average)}
			caption="across all runs"
			icon="target"
		/>
	</div>

	<Card>
		<div class="mb-3 flex items-baseline justify-between gap-3">
			<h3 class="text-ink text-[13px] font-semibold">Total duration per run</h3>
			<span class="text-ink-subtle text-[11px]">Lower is faster</span>
		</div>
		<LineChart
			{points}
			formatValue={formatDuration}
			emptyLabel="Run this session twice to see a trend."
		/>
	</Card>

	{#if showSteps}
		<Card>
			<h3 class="text-ink mb-3 text-[13px] font-semibold">Progress on each step</h3>
			<StepProgressTable steps={metrics.steps} />
		</Card>
	{/if}
</div>
