<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		padded?: boolean;
		interactive?: boolean;
		class?: string;
		children: Snippet;
	}

	let { padded = true, interactive = false, class: className = '', children }: Props = $props();
</script>

<div
	class="card {padded ? 'p-4 sm:p-5' : ''} {interactive
		? 'hover:border-line-strong transition-colors'
		: ''} {className}"
>
	{@render children()}
</div>
