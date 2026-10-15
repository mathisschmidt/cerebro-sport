<script lang="ts">
	import type { Exercise } from '$domain/models/exercise.ts';
	import {
		categoryOptionsOf,
		effectiveExerciseFilter,
		exerciseCategoryLabel,
		matchesExerciseFilter,
		tagsOf
	} from '$domain/models/exercise.ts';
	import { formatMeasure } from '$domain/models/common.ts';
	import ExerciseFilterButton from '$components/exercises/ExerciseFilterButton.svelte';
	import ExerciseFilters from '$components/exercises/ExerciseFilters.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import Modal from '$components/ui/Modal.svelte';
	import TextInput from '$components/ui/TextInput.svelte';

	/**
	 * Search-first picker — a plain <select> stops working past ~20 exercises.
	 * Several can be chosen in one go; they are handed back in the order they
	 * were tapped, which is the order they land in the block.
	 */
	interface Props {
		open: boolean;
		exercises: Exercise[];
		onpick: (exercises: Exercise[]) => void;
		oncreate?: () => void;
	}

	let { open = $bindable(), exercises, onpick, oncreate }: Props = $props();

	const uid = $props.id();

	let search = $state('');

	/** The same facets as the library. */
	let filtersOpen = $state(false);
	let selectedCategories = $state<string[]>([]);
	let selectedTags = $state<string[]>([]);

	const categoryOptions = $derived(categoryOptionsOf(exercises));
	const tagOptions = $derived(tagsOf(exercises));

	const filter = $derived(
		effectiveExerciseFilter(
			{ search, categories: selectedCategories, tags: selectedTags },
			categoryOptions,
			tagOptions
		)
	);
	const facetCount = $derived(filter.categories.length + filter.tags.length);

	const matches = $derived(exercises.filter((exercise) => matchesExerciseFilter(exercise, filter)));

	/**
	 * Chosen ids in tap order. Kept across search and filter changes, so a block
	 * can be assembled from more than one category without starting over.
	 */
	let selected = $state<string[]>([]);

	// Every opening starts from a clean slate — no search, no facets, no picks.
	$effect(() => {
		if (!open) return;
		search = '';
		filtersOpen = false;
		selectedCategories = [];
		selectedTags = [];
		selected = [];
	});

	function toggle(exercise: Exercise) {
		selected = selected.includes(exercise.id)
			? selected.filter((id) => id !== exercise.id)
			: [...selected, exercise.id];
	}

	function confirm() {
		const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
		const picked = selected.flatMap((id) => byId.get(id) ?? []);
		if (picked.length === 0) return;
		onpick(picked);
		open = false;
	}
</script>

<Modal bind:open title="Add exercises" subtitle="Tap to select, in the order you want them." size="sm">
	<div class="flex flex-col gap-3">
		<div class="flex items-center gap-2">
			<div class="relative min-w-0 flex-1">
				<span class="text-ink-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
					<Icon name="search" size={16} />
				</span>
				<TextInput
					bind:value={search}
					placeholder="Search exercises…"
					class="pl-9"
					autocomplete="off"
				/>
			</div>
			<ExerciseFilterButton bind:open={filtersOpen} count={facetCount} controls="{uid}-filters" />
		</div>

		<!-- The wrapper stays put so the button's `aria-controls` always resolves;
		     `contents` keeps it from adding a gap while the panel is closed. -->
		<div id="{uid}-filters" class="contents">
			{#if filtersOpen}
				<ExerciseFilters
					categories={categoryOptions}
					tags={tagOptions}
					bind:selectedCategories
					bind:selectedTags
					class=""
				/>
			{/if}
		</div>

		{#if matches.length === 0}
			<div class="py-8 text-center">
				<p class="text-ink-muted text-[13px]">
					{#if exercises.length === 0}
						No exercises yet.
					{:else if facetCount > 0}
						Nothing matches those filters.
					{:else}
						Nothing matches that search.
					{/if}
				</p>
				{#if oncreate}
					<Button
						variant="secondary"
						size="sm"
						icon="plus"
						class="mt-3"
						onclick={() => {
							open = false;
							oncreate?.();
						}}
					>
						Create an exercise
					</Button>
				{/if}
			</div>
		{:else}
			<ul class="-mx-1 flex max-h-[50dvh] flex-col gap-1 overflow-y-auto px-1">
				{#each matches as exercise (exercise.id)}
					{@const position = selected.indexOf(exercise.id) + 1}
					<li>
						<button
							type="button"
							aria-pressed={position > 0}
							class="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors
							{position > 0
								? 'border-accent bg-accent-soft'
								: 'border-line hover:border-line-strong hover:bg-surface'}"
							onclick={() => toggle(exercise)}
						>
							<div class="min-w-0 flex-1">
								<p class="text-ink truncate text-[13px] font-medium">{exercise.name}</p>
								<p class="text-ink-subtle truncate text-[11px]">
									{exerciseCategoryLabel(exercise)}
									{#if exercise.description}· {exercise.description}{/if}
								</p>
							</div>
							{#if exercise.defaultMeasure}
								<Badge tone="accent">{formatMeasure(exercise.defaultMeasure)}</Badge>
							{/if}
							{#if position > 0}
								<span
									class="bg-accent text-accent-ink grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
									aria-label="Selected, number {position}"
								>
									{position}
								</span>
							{:else}
								<span
									class="border-line-strong grid size-6 shrink-0 place-items-center rounded-full border"
									aria-hidden="true"
								></span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" icon="plus" disabled={selected.length === 0} onclick={confirm}>
			{selected.length === 0
				? 'Add'
				: `Add ${selected.length} exercise${selected.length > 1 ? 's' : ''}`}
		</Button>
	{/snippet}
</Modal>
