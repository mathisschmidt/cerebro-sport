<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	interface Props {
		icon?: IconName;
		title: string;
		description?: string;
		action?: Snippet;
		class?: string;
	}

	let { icon = 'layers', title, description, action, class: className = '' }: Props = $props();
</script>

<div
	class="border-line flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center {className}"
>
	<span class="bg-surface-sunken text-ink-subtle mb-3 grid size-11 place-items-center rounded-xl">
		<Icon name={icon} size={22} />
	</span>
	<p class="text-ink text-sm font-semibold">{title}</p>
	{#if description}
		<p class="text-ink-subtle mt-1 max-w-sm text-[13px] leading-relaxed">{description}</p>
	{/if}
	{#if action}
		<div class="mt-4">{@render action()}</div>
	{/if}
</div>
