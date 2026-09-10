<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = { value: string | number; invalid?: boolean; class?: string } & Omit<
		HTMLInputAttributes,
		'value' | 'class'
	>;

	let { value = $bindable(), invalid = false, class: className = '', ...rest }: Props = $props();
</script>

<input
	bind:value
	class="bg-surface-sunken text-ink placeholder:text-ink-subtle h-10 w-full rounded-[10px] border px-3 text-sm transition-colors outline-none
	{invalid ? 'border-danger' : 'border-line focus:border-accent'} {className}"
	{...rest}
/>
