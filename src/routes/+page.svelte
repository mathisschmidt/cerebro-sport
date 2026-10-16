<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { RoutineOccurrence } from '$domain/models/routine.ts';
	import { formatDuration } from '$domain/models/common.ts';
	import { workoutOutcome } from '$domain/models/workout.ts';
	import { formatDateLabel } from '$domain/services/date.ts';
	import { api, ApiError } from '$client/api.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import EmptyState from '$components/ui/EmptyState.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import Modal from '$components/ui/Modal.svelte';
	import Stat from '$components/ui/Stat.svelte';
	import ActivityHeatmap from '$components/charts/ActivityHeatmap.svelte';
	import OccurrenceCard from '$components/routines/OccurrenceCard.svelte';
	import OutcomeBadge from '$components/metrics/OutcomeBadge.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();

	let busyRoutineId = $state<string | null>(null);
	let starting = $state(false);
	let pickerOpen = $state(false);

	const pending = $derived(data.occurrences.filter((o) => o.status === 'pending'));
	const settled = $derived(data.occurrences.filter((o) => o.status !== 'pending'));

	const adherence7 = $derived(
		data.streak.last7.rate === null ? '—' : `${Math.round(data.streak.last7.rate * 100)}%`
	);

	async function startSession(sessionId: string, occurrence?: RoutineOccurrence) {
		starting = true;
		try {
			const workout = await api.workouts.start({
				sessionId,
				routineId: occurrence?.routineId ?? null,
				occurrenceDate: occurrence?.date ?? null
			});
			await goto(`/run/${workout.id}`);
		} catch (error) {
			toasts.error(error instanceof ApiError ? error.message : 'Could not start the session');
			starting = false;
		}
	}

	async function resolve(
		occurrence: RoutineOccurrence,
		status: 'completed' | 'skipped' | 'pending'
	) {
		busyRoutineId = occurrence.routineId;
		try {
			await api.routines.resolve({
				routineId: occurrence.routineId,
				date: occurrence.date,
				status,
				workoutId: null
			});
			await invalidateAll();
		} catch {
			toasts.error('Could not update that routine');
		} finally {
			busyRoutineId = null;
		}
	}
</script>

<svelte:head><title>Today — Cerebro Sport</title></svelte:head>

<div class="flex flex-col gap-6">
	<header>
		<p class="text-ink-subtle text-[13px]">{formatDateLabel(data.today)}</p>
		<h1 class="text-ink text-xl font-semibold sm:text-2xl">
			{pending.length === 0 ? 'Nothing left today' : `${pending.length} to go`}
		</h1>
	</header>

	<!-- Today's routines -->
	<section class="flex flex-col gap-2.5">
		<div class="flex items-center justify-between">
			<h2 class="text-ink text-[13px] font-semibold tracking-wide uppercase">On the plan</h2>
			<Button variant="ghost" size="sm" icon="play" onclick={() => (pickerOpen = true)}>
				Free session
			</Button>
		</div>

		{#if data.occurrences.length === 0}
			<EmptyState
				icon="calendar"
				title="No routine due today"
				description="Schedule a session to repeat, or just run one now."
			>
				{#snippet action()}
					<div class="flex flex-wrap justify-center gap-2">
						<Button variant="primary" size="sm" icon="play" onclick={() => (pickerOpen = true)}>
							Start a session
						</Button>
						<Button variant="secondary" size="sm" href="/library?tab=routines">
							Plan a routine
						</Button>
					</div>
				{/snippet}
			</EmptyState>
		{:else}
			{#each [...pending, ...settled] as occurrence (occurrence.routineId + occurrence.date)}
				<OccurrenceCard
					{occurrence}
					busy={busyRoutineId === occurrence.routineId || starting}
					onstart={() => startSession(occurrence.sessionId, occurrence)}
					onresolve={(status) => resolve(occurrence, status)}
				/>
			{/each}
		{/if}
	</section>

	<!-- Streak -->
	<section class="flex flex-col gap-3">
		<h2 class="text-ink text-[13px] font-semibold tracking-wide uppercase">Consistency</h2>

		<div class="grid grid-cols-3 gap-2.5">
			<Stat
				label="Current streak"
				value="{data.streak.currentStreak}d"
				caption="Best: {data.streak.longestStreak}d"
				icon="flame"
				accent
			/>
			<Stat
				label="Last 7 days"
				value={adherence7}
				caption="{data.streak.last7.completed}/{data.streak.last7.due} routines"
				icon="target"
			/>
			<Stat
				label="Done today"
				value="{data.streak.completedToday}/{data.streak.dueToday}"
				caption={data.streak.dueToday === 0 ? 'rest day' : 'routines'}
				icon="check"
			/>
		</div>

		<Card>
			<h3 class="text-ink mb-3 text-[13px] font-semibold">Training calendar</h3>
			<ActivityHeatmap days={data.streak.calendar} />
		</Card>
	</section>

	<!-- Later this week -->
	{#if data.upcoming.length > 0}
		<section class="flex flex-col gap-2.5">
			<h2 class="text-ink text-[13px] font-semibold tracking-wide uppercase">Later this week</h2>
			<Card padded={false}>
				<ul>
					{#each data.upcoming as occurrence (occurrence.routineId + occurrence.date)}
						<li
							class="border-line flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
						>
							<span class="text-ink-subtle w-20 shrink-0 text-[12px]">
								{formatDateLabel(occurrence.date, data.today)}
							</span>
							<span class="text-ink min-w-0 flex-1 truncate text-[13px]">
								{occurrence.sessionName}
							</span>
						</li>
					{/each}
				</ul>
			</Card>
		</section>
	{/if}

	<!-- Recent -->
	{#if data.recentWorkouts.length > 0}
		<section class="flex flex-col gap-2.5">
			<div class="flex items-center justify-between">
				<h2 class="text-ink text-[13px] font-semibold tracking-wide uppercase">Recent sessions</h2>
				<Button variant="ghost" size="sm" href="/metrics" iconRight="chevronRight">All metrics</Button>
			</div>
			<Card padded={false}>
				<ul>
					{#each data.recentWorkouts as workout (workout.id)}
						<li class="border-line flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
							<span class="text-ink-subtle shrink-0"><Icon name="history" size={15} /></span>
							<span class="text-ink min-w-0 flex-1 truncate text-[13px]">{workout.sessionName}</span>
							<OutcomeBadge outcome={workoutOutcome(workout)} />
						</li>
					{/each}
				</ul>
			</Card>
		</section>
	{/if}
</div>

<!-- Run any session, outside the schedule -->
<Modal bind:open={pickerOpen} title="Start a session" size="sm">
	{#if data.sessions.length === 0}
		<p class="text-ink-muted py-6 text-center text-[13px]">
			No sessions yet — build one in the library first.
		</p>
	{:else}
		<ul class="flex max-h-[55dvh] flex-col gap-1 overflow-y-auto">
			{#each data.sessions as session (session.id)}
				<li>
					<button
						type="button"
						class="border-line hover:border-line-strong hover:bg-surface flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
						onclick={() => {
							pickerOpen = false;
							startSession(session.id);
						}}
						disabled={starting}
					>
						<div class="min-w-0 flex-1">
							<p class="text-ink truncate text-[13px] font-medium">{session.name}</p>
							<p class="text-ink-subtle text-[11px]">
								{session.blockCount} blocks · {formatDuration(session.estimatedDurationSec * 1000)}
							</p>
						</div>
						<span class="text-accent shrink-0"><Icon name="play" size={15} filled /></span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</Modal>
