<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	type Props = { value: string; invalid?: boolean; class?: string } & Omit<
		HTMLTextareaAttributes,
		'value' | 'class'
	>;

	let {
		value = $bindable(),
		invalid = false,
		rows = 3,
		class: className = '',
		...rest
	}: Props = $props();
</script>

<textarea
	bind:value
	{rows}
	class="bg-surface-sunken text-ink placeholder:text-ink-subtle w-full resize-y rounded-[10px] border px-3 py-2.5 text-sm leading-relaxed transition-colors outline-none
	{invalid ? 'border-danger' : 'border-line focus:border-accent'} {className}"
	{...rest}
></textarea>
