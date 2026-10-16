<script lang="ts">
	import Icon from '$components/ui/Icon.svelte';

	/**
	 * Opens and closes `ExerciseFilters`. The panel collapses, so the count of
	 * chosen facets rides on the button and a filter is never applied invisibly.
	 */
	interface Props {
		open: boolean;
		count: number;
		/** Id of the element wrapping the panel, for `aria-controls`. */
		controls: string;
	}

	let { open = $bindable(), count, controls }: Props = $props();
</script>

<button
	type="button"
	class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-medium transition-colors
	{open || count > 0
		? 'border-accent bg-accent-soft text-accent'
		: 'border-line text-ink-muted hover:border-line-strong hover:text-ink'}"
	aria-expanded={open}
	aria-controls={controls}
	onclick={() => (open = !open)}
>
	<Icon name="filter" size={14} />
	Filters
	{#if count > 0}
		<span class="bg-accent text-accent-ink grid size-4 place-items-center rounded-full text-[10px]">
			{count}
		</span>
	{/if}
</button>
