<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type { Exercise, ExerciseWithUsage } from '$domain/models/exercise.ts';
	import {
		categoryOptionsOf,
		isExerciseFilterActive,
		matchesExerciseFilter,
		tagsOf
	} from '$domain/models/exercise.ts';
	import type { RoutineDetail } from '$domain/models/routine.ts';
	import { formatDuration } from '$domain/models/common.ts';
	import { api, ApiError } from '$client/api.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import ConfirmDialog from '$components/ui/ConfirmDialog.svelte';
	import EmptyState from '$components/ui/EmptyState.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import SegmentedControl from '$components/ui/SegmentedControl.svelte';
	import TextInput from '$components/ui/TextInput.svelte';
	import ExerciseFilters from '$components/exercises/ExerciseFilters.svelte';
	import ExerciseForm from '$components/exercises/ExerciseForm.svelte';
	import ExerciseRow from '$components/exercises/ExerciseRow.svelte';
	import RoutineForm from '$components/routines/RoutineForm.svelte';
	import RoutineRow from '$components/routines/RoutineRow.svelte';
	import PageHeader from '$components/shared/PageHeader.svelte';
	import type { PageData } from './$types.ts';

	let { data }: { data: PageData } = $props();

	type Tab = 'sessions' | 'exercises' | 'routines';
	const TABS = [
		{ value: 'sessions' as const, label: 'Sessions' },
		{ value: 'exercises' as const, label: 'Exercises' },
		{ value: 'routines' as const, label: 'Routines' }
	];

	/** The tab lives in the URL so a view can be linked to and survives a reload. */
	const tab = $derived((page.url.searchParams.get('tab') as Tab) ?? 'sessions');
	const tabProxy = {
		get value(): Tab {
			return tab;
		},
		set value(next: Tab) {
			void goto(`/library?tab=${next}`, { replaceState: true, noScroll: true, keepFocus: true });
		}
	};

	let search = $state('');

	/**
	 * The two facets, and whether their panel is open. Selections survive a tab
	 * switch; the button next to the search box carries the count so a filter is
	 * never applied invisibly.
	 */
	let filtersOpen = $state(false);
	let selectedCategories = $state<string[]>([]);
	let selectedTags = $state<string[]>([]);

	const categoryOptions = $derived(categoryOptionsOf(data.exercises.items));
	const tagOptions = $derived(tagsOf(data.exercises.items));

	/**
	 * Editing away the last exercise with a tag drops its chip; ignoring a
	 * selection that no longer has an option keeps the list from going
	 * permanently empty with nothing on screen to explain it.
	 */
	const exerciseFilter = $derived({
		search,
		categories: selectedCategories.filter((key) =>
			categoryOptions.some((option) => option.key === key)
		),
		tags: selectedTags.filter((tag) => tagOptions.includes(tag))
	});
	const facetCount = $derived(exerciseFilter.categories.length + exerciseFilter.tags.length);

	/** What an empty exercise list should say — a chosen facet explains it before the search does. */
	const noExerciseMatch = $derived(
		facetCount > 0
			? {
					title: 'Nothing matches those filters',
					description: 'No exercise in your library answers to all of that at once.',
					clearLabel: 'Clear filters'
				}
			: {
					title: 'Nothing matches that search',
					description: 'Nothing in your library goes by that name.',
					clearLabel: 'Clear search'
				}
	);

	function clearExerciseFilter() {
		search = '';
		selectedCategories = [];
		selectedTags = [];
	}

	let exerciseFormOpen = $state(false);
	let editingExercise = $state<Exercise | null>(null);
	let deletingExercise = $state<ExerciseWithUsage | null>(null);

	let routineFormOpen = $state(false);
	let editingRoutine = $state<RoutineDetail | null>(null);
	let deletingRoutine = $state<RoutineDetail | null>(null);

	let deletingSessionId = $state<string | null>(null);

	function matches(text: string): boolean {
		const term = search.trim().toLowerCase();
		return !term || text.toLowerCase().includes(term);
	}

	const visibleSessions = $derived(
		data.sessions.items.filter((session) => matches(`${session.name} ${session.description}`))
	);
	const visibleExercises = $derived(
		data.exercises.items.filter((exercise) => matchesExerciseFilter(exercise, exerciseFilter))
	);
	const visibleRoutines = $derived(
		data.routines.filter((routine) => matches(`${routine.name} ${routine.sessionName}`))
	);

	const deletingSession = $derived(
		data.sessions.items.find((session) => session.id === deletingSessionId) ?? null
	);

	async function remove(action: () => Promise<void>, label: string) {
		try {
			await action();
			toasts.success(`${label} deleted`);
			await invalidateAll();
		} catch (error) {
			toasts.error(error instanceof ApiError ? error.message : `Could not delete the ${label}`);
		}
	}
</script>

<svelte:head><title>Library — Cerebro Sport</title></svelte:head>

<PageHeader title="Library" subtitle="Your exercises, sessions and repeating plans.">
	{#snippet actions()}
		{#if tab === 'sessions'}
			<Button variant="primary" icon="plus" href="/library/sessions/new">New session</Button>
		{:else if tab === 'exercises'}
			<Button
				variant="primary"
				icon="plus"
				onclick={() => {
					editingExercise = null;
					exerciseFormOpen = true;
				}}
			>
				New exercise
			</Button>
		{:else}
			<Button
				variant="primary"
				icon="plus"
				onclick={() => {
					editingRoutine = null;
					routineFormOpen = true;
				}}
			>
				New routine
			</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
	<SegmentedControl bind:value={tabProxy.value} segments={TABS} class="w-full sm:w-auto" />
	<div class="relative min-w-0 flex-1 sm:max-w-xs">
		<span class="text-ink-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
			<Icon name="search" size={16} />
		</span>
		<TextInput bind:value={search} placeholder="Search…" class="pl-9" autocomplete="off" />
	</div>
	{#if tab === 'exercises'}
		<button
			type="button"
			class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-medium transition-colors
			{filtersOpen || facetCount > 0
				? 'border-accent bg-accent-soft text-accent'
				: 'border-line text-ink-muted hover:border-line-strong hover:text-ink'}"
			aria-expanded={filtersOpen}
			aria-controls="exercise-filters"
			onclick={() => (filtersOpen = !filtersOpen)}
		>
			<Icon name="filter" size={14} />
			Filters
			{#if facetCount > 0}
				<span class="bg-accent text-accent-ink grid size-4 place-items-center rounded-full text-[10px]">
					{facetCount}
				</span>
			{/if}
		</button>
	{/if}
</div>

<!-- The wrapper stays put so the button's `aria-controls` always resolves. -->
<div id="exercise-filters">
	{#if tab === 'exercises' && filtersOpen}
		<ExerciseFilters
			categories={categoryOptions}
			tags={tagOptions}
			bind:selectedCategories
			bind:selectedTags
		/>
	{/if}
</div>

{#if tab === 'sessions'}
	{#if visibleSessions.length === 0}
		<EmptyState
			icon="layers"
			title={data.sessions.items.length === 0 ? 'No sessions yet' : 'Nothing matches that search'}
			description="A session groups exercises into blocks — rounds, reps, timers and rest."
		>
			{#snippet action()}
				<Button variant="primary" size="sm" icon="plus" href="/library/sessions/new">
					Build a session
				</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="grid gap-2.5 sm:grid-cols-2">
			{#each visibleSessions as session (session.id)}
				<Card padded={false} interactive>
					<div class="flex items-start gap-3 p-3.5 sm:p-4">
						<a href="/library/sessions/{session.id}" class="min-w-0 flex-1">
							<h3 class="text-ink truncate text-sm font-semibold">{session.name}</h3>
							{#if session.description}
								<p class="text-ink-muted mt-0.5 line-clamp-2 text-[13px] leading-snug">
									{session.description}
								</p>
							{/if}
							<p class="text-ink-subtle mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px]">
								<span class="inline-flex items-center gap-1">
									<Icon name="layers" size={11} />
									{session.blockCount} block{session.blockCount > 1 ? 's' : ''}
								</span>
								<span class="inline-flex items-center gap-1">
									<Icon name="zap" size={11} />
									{session.exerciseCount} sets
								</span>
								<span class="inline-flex items-center gap-1">
									<Icon name="clock" size={11} />
									{formatDuration(session.estimatedDurationSec * 1000)}
								</span>
							</p>
						</a>
						<button
							type="button"
							class="text-ink-subtle hover:text-danger hover:bg-danger/10 grid size-9 shrink-0 place-items-center rounded-lg transition-colors"
							onclick={() => (deletingSessionId = session.id)}
							aria-label="Delete {session.name}"
						>
							<Icon name="trash" size={16} />
						</button>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
{:else if tab === 'exercises'}
	{#if visibleExercises.length === 0}
		<EmptyState
			icon="dumbbell"
			title={data.exercises.items.length === 0 ? 'No exercises yet' : noExerciseMatch.title}
			description={data.exercises.items.length === 0
				? 'Pull-ups, jumping jacks, a 400m sprint, a free-kick drill — anything you repeat.'
				: noExerciseMatch.description}
		>
			{#snippet action()}
				{#if isExerciseFilterActive(exerciseFilter)}
					<Button size="sm" icon="close" onclick={clearExerciseFilter}>
						{noExerciseMatch.clearLabel}
					</Button>
				{:else}
					<Button
						variant="primary"
						size="sm"
						icon="plus"
						onclick={() => {
							editingExercise = null;
							exerciseFormOpen = true;
						}}
					>
						Add an exercise
					</Button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<div class="flex flex-col gap-2.5">
			{#each visibleExercises as exercise (exercise.id)}
				<ExerciseRow
					{exercise}
					onedit={() => {
						editingExercise = exercise;
						exerciseFormOpen = true;
					}}
					ondelete={() => (deletingExercise = exercise)}
				/>
			{/each}
		</div>
	{/if}
{:else if visibleRoutines.length === 0}
	<EmptyState
		icon="repeat"
		title={data.routines.length === 0 ? 'No routines yet' : 'Nothing matches that search'}
		description="Put a session on a repeat — every day, certain weekdays, or every few weeks."
	>
		{#snippet action()}
			<Button
				variant="primary"
				size="sm"
				icon="plus"
				onclick={() => {
					editingRoutine = null;
					routineFormOpen = true;
				}}
			>
				Schedule a session
			</Button>
		{/snippet}
	</EmptyState>
{:else}
	<div class="flex flex-col gap-2.5">
		{#each visibleRoutines as routine (routine.id)}
			<RoutineRow
				{routine}
				onedit={() => {
					editingRoutine = routine;
					routineFormOpen = true;
				}}
				ondelete={() => (deletingRoutine = routine)}
			/>
		{/each}
	</div>
{/if}

<ExerciseForm
	bind:open={exerciseFormOpen}
	exercise={editingExercise}
	library={data.exercises.items}
	onsaved={() => invalidateAll()}
/>

<RoutineForm
	bind:open={routineFormOpen}
	routine={editingRoutine}
	sessions={data.sessions.items}
	onsaved={() => invalidateAll()}
/>

<ConfirmDialog
	open={deletingExercise !== null}
	title="Delete this exercise?"
	message="{deletingExercise?.name} will be removed from your library. Sessions already using it must be updated first."
	confirmLabel="Delete"
	danger
	onconfirm={async () => {
		const target = deletingExercise;
		deletingExercise = null;
		if (target) await remove(() => api.exercises.remove(target.id), 'exercise');
	}}
/>

<ConfirmDialog
	open={deletingRoutine !== null}
	title="Delete this routine?"
	message="The schedule stops, but every workout you already logged from it is kept."
	confirmLabel="Delete"
	danger
	onconfirm={async () => {
		const target = deletingRoutine;
		deletingRoutine = null;
		if (target) await remove(() => api.routines.remove(target.id), 'routine');
	}}
/>

<ConfirmDialog
	open={deletingSessionId !== null}
	title="Delete this session?"
	message="{deletingSession?.name} will be removed. Past workouts keep their own copy, so your history stays intact."
	confirmLabel="Delete"
	danger
	onconfirm={async () => {
		const target = deletingSessionId;
		deletingSessionId = null;
		if (target) await remove(() => api.sessions.remove(target), 'session');
	}}
/>
