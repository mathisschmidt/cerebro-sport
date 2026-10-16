<script lang="ts">
	import { formatDuration } from '$domain/models/common.ts';
	import { formatDateLabel } from '$domain/services/date.ts';
	import Card from '$components/ui/Card.svelte';
	import EmptyState from '$components/ui/EmptyState.svelte';
	import Button from '$components/ui/Button.svelte';
	import Stat from '$components/ui/Stat.svelte';
	import ActivityHeatmap from '$components/charts/ActivityHeatmap.svelte';
	import BarChart from '$components/charts/BarChart.svelte';
	import TrendPill from '$components/charts/TrendPill.svelte';
	import SessionMetricsPanel from '$components/metrics/SessionMetricsPanel.svelte';
	import PageHeader from '$components/shared/PageHeader.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();

	const { overview, streak, sessions } = $derived(data.metrics);

	let selectedId = $state<string | null>(null);
	const selected = $derived(
		sessions.find((session) => session.sessionId === selectedId) ?? sessions[0] ?? null
	);

	const weekly = $derived(
		overview.weekly.map((point) => ({
			label: formatDateLabel(point.weekStart),
			value: point.totalMs,
			display: formatDuration(point.totalMs),
			caption: `${point.workouts} workout${point.workouts === 1 ? '' : 's'}`
		}))
	);

	const adherence30 = $derived(
		streak.last30.rate === null ? '—' : `${Math.round(streak.last30.rate * 100)}%`
	);
</script>

<svelte:head><title>Metrics — Cerebro Sport</title></svelte:head>

<PageHeader title="Metrics" subtitle="Where the time goes, and whether it is going faster." />

{#if overview.totalWorkouts === 0}
	<EmptyState
		icon="chart"
		title="Nothing measured yet"
		description="Run a session and this page fills itself in — total time, progress, streaks."
	>
		{#snippet action()}
			<Button variant="primary" size="sm" href="/" icon="play">Go train</Button>
		{/snippet}
	</EmptyState>
{:else}
	<div class="flex flex-col gap-6">
		<!-- Overview -->
		<section class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
			<Stat
				label="Sessions run"
				value={String(overview.totalWorkouts)}
				caption="{overview.sessionsPracticed} different"
				icon="history"
			/>
			<Stat
				label="Total time"
				value={formatDuration(overview.totalMs)}
				caption="start to end, breaks included"
				icon="clock"
				accent
			/>
			<Stat
				label="Training days"
				value={String(overview.activeDays)}
				caption="days with a session"
				icon="calendar"
			/>
			<Stat
				label="Average session"
				value={formatDuration(overview.averageWorkoutMs)}
				caption="fully completed runs"
				icon="target"
			/>
		</section>

		<!-- Volume -->
		<Card>
			<div class="mb-4 flex items-baseline justify-between gap-3">
				<h2 class="text-ink text-[13px] font-semibold">Weekly volume</h2>
				<span class="text-ink-subtle text-[11px]">Last {overview.weekly.length} weeks</span>
			</div>
			<BarChart
				data={weekly}
				formatValue={formatDuration}
				emptyLabel="No sessions in this window."
			/>
		</Card>

		<!-- Consistency -->
		<section class="flex flex-col gap-3">
			<h2 class="text-ink text-[13px] font-semibold tracking-wide uppercase">Consistency</h2>
			<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
				<Stat
					label="Current streak"
					value="{streak.currentStreak}d"
					caption="scheduled days honoured"
					icon="flame"
					accent
				/>
				<Stat
					label="Longest streak"
					value="{streak.longestStreak}d"
					caption="personal best"
					icon="zap"
				/>
				<Stat
					label="Last 30 days"
					value={adherence30}
					caption="{streak.last30.completed}/{streak.last30.due} routines done"
					icon="target"
				/>
				<Stat
					label="Last 7 days"
					value={streak.last7.rate === null ? '—' : `${Math.round(streak.last7.rate * 100)}%`}
					caption="{streak.last7.completed}/{streak.last7.due} routines done"
					icon="check"
				/>
			</div>
			<Card>
				<h3 class="text-ink mb-3 text-[13px] font-semibold">Training calendar</h3>
				<ActivityHeatmap days={streak.calendar} />
			</Card>
		</section>

		<!-- Per session -->
		{#if sessions.length > 0 && selected}
			<section class="flex flex-col gap-3">
				<h2 class="text-ink text-[13px] font-semibold tracking-wide uppercase">By session</h2>

				<!-- Picker doubles as an at-a-glance comparison of every session -->
				<div class="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
					{#each sessions as session (session.sessionId)}
						<button
							type="button"
							class="shrink-0 rounded-xl border px-3.5 py-2.5 text-left transition-colors
							{selected.sessionId === session.sessionId
								? 'border-accent bg-accent-soft'
								: 'border-line hover:border-line-strong'}"
							onclick={() => (selectedId = session.sessionId)}
							aria-pressed={selected.sessionId === session.sessionId}
						>
							<p class="text-ink max-w-[12rem] truncate text-[13px] font-medium">
								{session.sessionName}
							</p>
							<p class="text-ink-subtle mt-0.5 text-[11px]">
								{#if session.runCount > 0}
									{session.runCount} completed · {formatDuration(session.duration.latest)}
								{:else}
									No completed run yet
								{/if}
							</p>
							<div class="mt-1.5">
								<TrendPill trend={session.trend} deltaPct={session.deltaPct} />
							</div>
						</button>
					{/each}
				</div>

				<SessionMetricsPanel metrics={selected} />
			</section>
		{/if}
	</div>
{/if}
