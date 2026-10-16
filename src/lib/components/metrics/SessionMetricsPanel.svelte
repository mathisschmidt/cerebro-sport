<script lang="ts">
	import type { SessionMetrics } from '$domain/models/metrics.ts';
	import { formatDuration } from '$domain/models/common.ts';
	import { formatDateLabel } from '$domain/services/date.ts';
	import Card from '$components/ui/Card.svelte';
	import Stat from '$components/ui/Stat.svelte';
	import LineChart from '$components/charts/LineChart.svelte';
	import TrendPill from '$components/charts/TrendPill.svelte';
	import OutcomeBadge from './OutcomeBadge.svelte';

	/**
	 * One session's progress, in one measure: total time, start to end, breaks
	 * included. The stats and the chart use fully completed runs only; the
	 * history below lists every run, coloured by how it went.
	 */
	interface Props {
		metrics: SessionMetrics;
	}

	let { metrics }: Props = $props();

	/** With no fully completed run yet there is no time worth showing. */
	const duration = (ms: number) => (metrics.runCount > 0 ? formatDuration(ms) : '—');

	const points = $derived(
		metrics.history.map((point) => ({
			label: formatDateLabel(point.date),
			value: point.totalMs
		}))
	);
</script>

<div class="flex flex-col gap-4">
	<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
		<Stat label="Runs" value={String(metrics.runCount)} caption="fully completed" icon="history" />
		<Stat label="Last time" value={duration(metrics.duration.latest)} icon="clock">
			{#snippet trend()}
				<TrendPill trend={metrics.trend} deltaPct={metrics.deltaPct} />
			{/snippet}
		</Stat>
		<Stat
			label="Best"
			value={duration(metrics.duration.best)}
			caption="fastest run"
			icon="zap"
			accent
		/>
		<Stat
			label="Average"
			value={duration(metrics.duration.average)}
			caption="across completed runs"
			icon="target"
		/>
	</div>

	<Card>
		<div class="mb-3 flex items-baseline justify-between gap-3">
			<h3 class="text-ink text-[13px] font-semibold">Total time per run</h3>
			<span class="text-ink-subtle text-[11px]">Lower is faster · completed runs</span>
		</div>
		<LineChart
			{points}
			formatValue={formatDuration}
			emptyLabel="Complete this session twice to see a trend."
		/>
	</Card>

	<Card padded={false}>
		<h3 class="text-ink px-4 pt-4 pb-2 text-[13px] font-semibold">History</h3>
		<ul>
			{#each metrics.runs as run (run.workoutId)}
				<li class="border-line flex items-center gap-3 border-t px-4 py-2.5">
					<span class="text-ink-muted min-w-0 flex-1 truncate text-[13px]">
						{formatDateLabel(run.date)}
					</span>
					<OutcomeBadge outcome={run.outcome} />
				</li>
			{/each}
		</ul>
	</Card>
</div>
