<script lang="ts">
	/**
	 * A 12-ish point trend line for stat tiles and table rows. Single series, so
	 * no legend: whatever labels the row says what is plotted. The end point is
	 * the only marked one — the value that matters is "where am I now".
	 */
	interface Props {
		values: number[];
		width?: number;
		height?: number;
		/** Lower is better (durations), so the line is inverted for reading. */
		class?: string;
		label?: string;
	}

	let { values, width = 88, height = 28, class: className = '', label }: Props = $props();

	const PAD = 4;

	const points = $derived.by(() => {
		if (values.length === 0) return [];
		const min = Math.min(...values);
		const max = Math.max(...values);
		const span = max - min || 1;
		const innerW = width - PAD * 2;
		const innerH = height - PAD * 2;
		return values.map((value, index) => {
			const x = PAD + (values.length === 1 ? innerW / 2 : (index / (values.length - 1)) * innerW);
			const y = PAD + innerH - ((value - min) / span) * innerH;
			return [x, y] as const;
		});
	});

	const path = $derived(points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' '));
	const last = $derived(points.at(-1));
</script>

{#if points.length > 1}
	<svg
		class={className}
		{width}
		{height}
		viewBox="0 0 {width} {height}"
		role="img"
		aria-label={label ?? 'Trend'}
	>
		<path d={path} fill="none" stroke="var(--viz-series)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
		{#if last}
			<!-- 2px surface ring keeps the end dot legible where it meets the line -->
			<circle cx={last[0]} cy={last[1]} r="4" fill="var(--viz-series)" stroke="var(--app-surface)" stroke-width="2" />
		{/if}
	</svg>
{:else}
	<span class="text-ink-subtle text-[11px]">—</span>
{/if}
