<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	type Props = {
		value: string | number;
		invalid?: boolean;
		class?: string;
		children: Snippet;
	} & Omit<HTMLSelectAttributes, 'value' | 'class'>;

	let {
		value = $bindable(),
		invalid = false,
		class: className = '',
		children,
		...rest
	}: Props = $props();
</script>

<div class="relative {className}">
	<select
		bind:value
		class="bg-surface-sunken text-ink h-10 w-full appearance-none rounded-[10px] border px-3 pr-9 text-sm transition-colors outline-none
		{invalid ? 'border-danger' : 'border-line focus:border-accent'}"
		{...rest}
	>
		{@render children()}
	</select>
	<span class="text-ink-subtle pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">
		<Icon name="chevronDown" size={16} />
	</span>
</div>
