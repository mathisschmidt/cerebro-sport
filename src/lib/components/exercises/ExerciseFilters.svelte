<script lang="ts">
	import type { CategoryOption } from '$domain/models/exercise.ts';
	import Icon from '$components/ui/Icon.svelte';
	import ToggleChip from '$components/ui/ToggleChip.svelte';

	/**
	 * The two facets of the exercise library: its categories and its tags. Both
	 * option lists are derived from the library itself, so a chip only ever
	 * appears when something carries it.
	 */
	interface Props {
		categories: CategoryOption[];
		tags: string[];
		selectedCategories: string[];
		selectedTags: string[];
	}

	let {
		categories,
		tags,
		selectedCategories = $bindable(),
		selectedTags = $bindable()
	}: Props = $props();

	const chosen = $derived(selectedCategories.length + selectedTags.length);

	function toggle(list: string[], value: string): string[] {
		return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
	}
</script>

<div class="border-line bg-surface-sunken/40 mb-4 flex flex-col gap-3 rounded-xl border p-3">
	{#if categories.length > 0}
		<div class="flex flex-col gap-1.5">
			<span class="text-ink-subtle flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
				<Icon name="dumbbell" size={12} /> Category
			</span>
			<div class="flex flex-wrap gap-1.5">
				{#each categories as option (option.key)}
					<ToggleChip
						active={selectedCategories.includes(option.key)}
						onclick={() => (selectedCategories = toggle(selectedCategories, option.key))}
					>
						{option.label}
					</ToggleChip>
				{/each}
			</div>
		</div>
	{/if}

	{#if tags.length > 0}
		<div class="flex flex-col gap-1.5">
			<span class="text-ink-subtle flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
				<Icon name="tag" size={12} /> Tags
			</span>
			<div class="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
				{#each tags as tag (tag)}
					<ToggleChip
						active={selectedTags.includes(tag)}
						onclick={() => (selectedTags = toggle(selectedTags, tag))}
					>
						{tag}
					</ToggleChip>
				{/each}
			</div>
		</div>
	{/if}

	{#if categories.length === 0 && tags.length === 0}
		<p class="text-ink-subtle text-[12px]">
			Nothing to filter by yet — give an exercise a category or a tag and it shows up here.
		</p>
	{:else if chosen > 0}
		<div class="border-line flex justify-end border-t pt-2.5">
			<button
				type="button"
				class="text-ink-muted hover:text-ink inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] transition-colors"
				onclick={() => {
					selectedCategories = [];
					selectedTags = [];
				}}
			>
				<Icon name="close" size={12} />
				Clear {chosen} filter{chosen > 1 ? 's' : ''}
			</button>
		</div>
	{/if}
</div>
