<script lang="ts">
	import type { TrendDirection } from '$domain/models/metrics.ts';
	import Icon from '$components/ui/Icon.svelte';

	/**
	 * Faster / slower, as a status. Status colour never carries the meaning on
	 * its own: every pill ships an arrow and a word alongside it.
	 */
	interface Props {
		trend: TrendDirection;
		deltaPct: number | null;
		/** Durations improve downward; a rep count would not. */
		lowerIsBetter?: boolean;
		size?: 'sm' | 'md';
	}

	let { trend, deltaPct, lowerIsBetter = true, size = 'sm' }: Props = $props();

	const MAP = {
		faster: { icon: 'arrowDown', word: 'faster' },
		slower: { icon: 'arrowUp', word: 'slower' },
		flat: { icon: 'arrowRight', word: 'steady' },
		unknown: { icon: 'arrowRight', word: 'first run' }
	} as const;

	const good = $derived(lowerIsBetter ? trend === 'faster' : trend === 'slower');
	const bad = $derived(lowerIsBetter ? trend === 'slower' : trend === 'faster');

	const color = $derived(
		good ? 'var(--viz-good)' : bad ? 'var(--viz-critical)' : 'var(--app-text-subtle)'
	);
	const magnitude = $derived(deltaPct === null ? null : Math.abs(deltaPct));
</script>

<span
	class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium whitespace-nowrap {size ===
	'sm'
		? 'text-[11px]'
		: 'text-xs'}"
	style="color:{color};background:color-mix(in oklab, {color} 12%, transparent)"
>
	<Icon name={MAP[trend].icon} size={size === 'sm' ? 11 : 13} />
	{#if magnitude !== null && trend !== 'unknown'}
		<span class="tabular">{magnitude < 1 ? '<1' : Math.round(magnitude)}%</span>
	{/if}
	{MAP[trend].word}
</span>
