<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDuration } from '$domain/models/common.ts';
	import { describeRecurrence } from '$domain/models/routine.ts';
	import { api, ApiError } from '$client/api.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import PlanPreview from '$components/sessions/PlanPreview.svelte';
	import SessionMetricsPanel from '$components/metrics/SessionMetricsPanel.svelte';
	import PageHeader from '$components/shared/PageHeader.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();

	let starting = $state(false);

	async function start() {
		starting = true;
		try {
			const workout = await api.workouts.start({
				sessionId: data.session.id,
				routineId: null,
				occurrenceDate: null
			});
			await goto(`/run/${workout.id}`);
		} catch (error) {
			toasts.error(error instanceof ApiError ? error.message : 'Could not start the session');
			starting = false;
		}
	}
</script>

<svelte:head><title>{data.session.name} — Van Damme</title></svelte:head>

<PageHeader
	title={data.session.name}
	subtitle={data.session.description || undefined}
	back={{ href: '/library?tab=sessions', label: 'Library' }}
>
	{#snippet actions()}
		<Button variant="secondary" icon="pencil" href="/library/sessions/{data.session.id}/edit">
			<span class="max-sm:hidden">Edit</span>
		</Button>
		<Button variant="primary" icon="play" loading={starting} onclick={start}>Start</Button>
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-4">
	<Card>
		<h2 class="text-ink mb-3 text-[13px] font-semibold">The plan</h2>
		<PlanPreview session={data.session} />
	</Card>

	{#if data.routines.length > 0}
		<Card>
			<h2 class="text-ink mb-2.5 text-[13px] font-semibold">Scheduled by</h2>
			<ul class="flex flex-col gap-1.5">
				{#each data.routines as routine (routine.id)}
					<li class="flex items-center gap-2 text-[13px]">
						<span class="text-accent shrink-0"><Icon name="repeat" size={14} /></span>
						<span class="text-ink">{routine.name || routine.sessionName}</span>
						<span class="text-ink-subtle">— {describeRecurrence(routine.recurrence)}</span>
						{#if !routine.active}<Badge tone="warning">Paused</Badge>{/if}
					</li>
				{/each}
			</ul>
		</Card>
	{/if}

	<section>
		<h2 class="text-ink mb-3 text-[13px] font-semibold tracking-wide uppercase">
			Your history
			{#if data.metrics.runCount > 0}
				<span class="text-ink-subtle ml-1 font-normal normal-case">
					· {data.metrics.runCount} run{data.metrics.runCount > 1 ? 's' : ''},
					{formatDuration(data.metrics.duration.average)} on average
				</span>
			{/if}
		</h2>

		{#if data.metrics.runCount === 0}
			<Card>
				<p class="text-ink-subtle py-6 text-center text-[13px]">
					No runs yet. Start the session and it will start tracking itself.
				</p>
			</Card>
		{:else}
			<SessionMetricsPanel metrics={data.metrics} />
		{/if}
	</section>
</div>
