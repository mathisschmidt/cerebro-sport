<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		hint?: string;
		error?: string;
		required?: boolean;
		for?: string;
		class?: string;
		children: Snippet;
	}

	let {
		label,
		hint,
		error,
		required = false,
		for: htmlFor,
		class: className = '',
		children
	}: Props = $props();
</script>

<div class="flex flex-col gap-1.5 {className}">
	{#if label}
		<label class="text-ink-muted text-[13px] font-medium" for={htmlFor}>
			{label}
			{#if required}<span class="text-danger">*</span>{/if}
		</label>
	{/if}
	{@render children()}
	{#if error}
		<p class="text-danger text-xs">{error}</p>
	{:else if hint}
		<p class="text-ink-subtle text-xs">{hint}</p>
	{/if}
</div>
