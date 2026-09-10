<script lang="ts">
	import Icon from './Icon.svelte';

	/**
	 * Toggleable chips over a known option list. Faster than a multi-select on
	 * both a mouse and a thumb, and it shows every choice at once.
	 */
	interface Props {
		selected: string[];
		options: string[];
		emptyLabel?: string;
		maxHeight?: string;
		id?: string;
	}

	let {
		selected = $bindable(),
		options,
		emptyLabel = 'Nothing to choose from yet',
		maxHeight = '10rem',
		id
	}: Props = $props();

	function toggle(option: string) {
		selected = selected.includes(option)
			? selected.filter((entry) => entry !== option)
			: [...selected, option];
	}
</script>

{#if options.length === 0}
	<p class="text-ink-subtle text-[12px]">{emptyLabel}</p>
{:else}
	<div
		{id}
		class="border-line flex flex-wrap gap-1.5 overflow-y-auto rounded-[10px] border p-2"
		style="max-height:{maxHeight}"
	>
		{#each options as option (option)}
			<button
				type="button"
				class="inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[12px] transition-colors
				{selected.includes(option)
					? 'border-accent bg-accent-soft text-accent font-medium'
					: 'border-line text-ink-muted hover:border-line-strong hover:text-ink'}"
				onclick={() => toggle(option)}
				aria-pressed={selected.includes(option)}
			>
				{#if selected.includes(option)}<Icon name="check" size={12} />{/if}
				{option}
			</button>
		{/each}
	</div>
{/if}
