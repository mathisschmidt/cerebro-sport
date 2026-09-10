<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	/**
	 * Stat tile: label, value, optional delta and trend. The value uses
	 * proportional figures — tabular digits look loose at display sizes and are
	 * reserved for columns that have to align.
	 */
	interface Props {
		label: string;
		value: string;
		caption?: string;
		icon?: IconName;
		accent?: boolean;
		trend?: Snippet;
		class?: string;
	}

	let { label, value, caption, icon, accent = false, trend, class: className = '' }: Props = $props();
</script>

<div class="card flex flex-col gap-1 p-3.5 sm:p-4 {className}">
	<div class="text-ink-muted flex items-center gap-1.5 text-[11px] font-medium">
		{#if icon}
			<span class={accent ? 'text-accent' : 'text-ink-subtle'}><Icon name={icon} size={13} /></span>
		{/if}
		<span class="truncate">{label}</span>
	</div>
	<p class="text-ink text-2xl leading-tight font-semibold {accent ? 'text-accent' : ''}">
		{value}
	</p>
	{#if trend}
		<div class="mt-0.5">{@render trend()}</div>
	{:else if caption}
		<p class="text-ink-subtle truncate text-[11px]">{caption}</p>
	{/if}
</div>
