<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		actions?: Snippet;
		back?: { href: string; label: string };
	}

	let { title, subtitle, actions, back }: Props = $props();
</script>

<header class="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
	<div class="min-w-0">
		{#if back}
			<a
				href={back.href}
				class="text-ink-subtle hover:text-ink mb-1 inline-flex items-center gap-1 text-[12px] transition-colors"
			>
				← {back.label}
			</a>
		{/if}
		<h1 class="text-ink truncate text-xl font-semibold sm:text-2xl">{title}</h1>
		{#if subtitle}
			<p class="text-ink-muted mt-0.5 text-[13px] sm:text-sm">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
	{/if}
</header>
