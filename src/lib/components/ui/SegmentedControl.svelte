<script lang="ts" module>
	export interface Segment<T extends string = string> {
		value: T;
		label: string;
	}
</script>

<script lang="ts" generics="T extends string">
	interface Props {
		value: T;
		segments: Segment<T>[];
		size?: 'sm' | 'md';
		class?: string;
	}

	let { value = $bindable(), segments, size = 'md', class: className = '' }: Props = $props();
</script>

<div
	class="bg-surface-sunken border-line inline-flex rounded-[10px] border p-0.5 {className}"
	role="tablist"
>
	{#each segments as segment (segment.value)}
		<button
			type="button"
			role="tab"
			aria-selected={value === segment.value}
			class="flex-1 rounded-lg px-3 font-medium whitespace-nowrap transition-colors {size === 'sm'
				? 'h-7 text-[12px]'
				: 'h-8 text-[13px]'}
			{value === segment.value
				? 'bg-surface-raised text-ink shadow-card'
				: 'text-ink-muted hover:text-ink'}"
			onclick={() => (value = segment.value)}
		>
			{segment.label}
		</button>
	{/each}
</div>
