<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	/**
	 * One option, on or off. Same chip language as `ChipSelect`, but each chip is
	 * its own piece of state — used to reveal a field only once it has been asked
	 * for, so a long form can start as a short one.
	 */
	interface Props {
		active: boolean;
		onclick: () => void;
		class?: string;
		children: Snippet;
	}

	let { active, onclick, class: className = '', children }: Props = $props();
</script>

<button
	type="button"
	aria-pressed={active}
	{onclick}
	class="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[12px] transition-colors
	{active
		? 'border-accent bg-accent-soft text-accent font-medium'
		: 'border-line text-ink-muted hover:border-line-strong hover:text-ink'} {className}"
>
	<Icon name={active ? 'check' : 'plus'} size={12} />
	{@render children()}
</button>
