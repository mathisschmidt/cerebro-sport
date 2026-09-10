<script lang="ts">
	import Icon from './Icon.svelte';

	/**
	 * A number field with tap targets on both sides. Typing stays available on
	 * desktop; the buttons are what make it usable with one hand mid-session.
	 */
	interface Props {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		suffix?: string;
		id?: string;
		invalid?: boolean;
		class?: string;
		ariaLabel?: string;
	}

	let {
		value = $bindable(),
		min = 0,
		max = 9999,
		step = 1,
		suffix,
		id,
		invalid = false,
		class: className = '',
		ariaLabel
	}: Props = $props();

	function clamp(next: number): number {
		if (Number.isNaN(next)) return min;
		return Math.min(max, Math.max(min, next));
	}

	function nudge(delta: number) {
		value = clamp(value + delta);
	}
</script>

<div
	class="bg-surface-sunken flex h-10 items-stretch overflow-hidden rounded-[10px] border transition-colors
	{invalid ? 'border-danger' : 'border-line focus-within:border-accent'} {className}"
>
	<button
		type="button"
		class="text-ink-muted hover:text-ink hover:bg-surface-raised grid w-10 shrink-0 place-items-center transition-colors disabled:opacity-30"
		onclick={() => nudge(-step)}
		disabled={value <= min}
		aria-label="Decrease"
	>
		<Icon name="minus" size={16} />
	</button>
	<input
		{id}
		type="number"
		inputmode="numeric"
		aria-label={ariaLabel}
		class="tabular text-ink w-full min-w-0 border-0 bg-transparent text-center text-sm outline-none
		[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
		{min}
		{max}
		{step}
		{value}
		oninput={(event) => (value = clamp(event.currentTarget.valueAsNumber))}
		onblur={(event) => {
			value = clamp(event.currentTarget.valueAsNumber);
			event.currentTarget.value = String(value);
		}}
	/>
	{#if suffix}
		<span class="text-ink-subtle grid shrink-0 place-items-center pr-1 text-xs">{suffix}</span>
	{/if}
	<button
		type="button"
		class="text-ink-muted hover:text-ink hover:bg-surface-raised grid w-10 shrink-0 place-items-center transition-colors disabled:opacity-30"
		onclick={() => nudge(step)}
		disabled={value >= max}
		aria-label="Increase"
	>
		<Icon name="plus" size={16} />
	</button>
</div>
