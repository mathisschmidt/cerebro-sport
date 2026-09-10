<script lang="ts">
	import { durationScale } from '$domain/services/scale.ts';

	/**
	 * Change over time for one measure — session duration across executions.
	 * One series, so no legend: the card title says what is plotted. The latest
	 * value is labelled directly on the line; the axis carries the rest.
	 */
	export interface LinePoint {
		label: string;
		value: number;
		caption?: string;
	}

	interface Props {
		points: LinePoint[];
		height?: number;
		formatValue?: (value: number) => string;
		emptyLabel?: string;
	}

	let {
		points,
		height = 190,
		formatValue = (value: number) => String(value),
		emptyLabel = 'Not enough history yet'
	}: Props = $props();

	const PAD_Y = 18;
	const WIDTH = 320; // viewBox units; the svg scales to its container

	const scale = $derived.by(() => {
		const values = points.map((point) => point.value);
		return durationScale(Math.min(...values), Math.max(...values), { ticks: 3 });
	});

	const plotHeight = $derived(height - PAD_Y * 2);

	function yOf(value: number): number {
		const span = scale.max - scale.min || 1;
		return PAD_Y + plotHeight - ((value - scale.min) / span) * plotHeight;
	}

	const coords = $derived(
		points.map((point, index) => ({
			x: points.length === 1 ? WIDTH / 2 : (index / (points.length - 1)) * WIDTH,
			y: yOf(point.value),
			point
		}))
	);

	const linePath = $derived(coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y}`).join(' '));
	const areaPath = $derived(
		coords.length > 0
			? `${linePath} L${coords[coords.length - 1]!.x} ${height} L${coords[0]!.x} ${height} Z`
			: ''
	);

	let hovered = $state<number | null>(null);
	const active = $derived(hovered === null ? null : coords[hovered]);
	const last = $derived(coords[coords.length - 1]);
	/** Hovered point when there is one, otherwise the latest run. */
	const marker = $derived(active ?? last);

	function onmove(event: PointerEvent) {
		const rect =
			event.currentTarget instanceof Element ? event.currentTarget.getBoundingClientRect() : null;
		if (!rect || coords.length === 0) return;
		const ratio = (event.clientX - rect.left) / rect.width;
		hovered = Math.min(coords.length - 1, Math.max(0, Math.round(ratio * (coords.length - 1))));
	}
</script>

{#if points.length < 2}
	<p class="text-ink-subtle py-10 text-center text-[13px]">{emptyLabel}</p>
{:else}
	<div class="flex gap-2.5">
		<!-- Axis ticks carry every value that is not directly labelled -->
		<div
			class="text-ink-subtle tabular relative w-14 shrink-0 text-right text-[10px]"
			style="height:{height}px"
			aria-hidden="true"
		>
			{#each scale.ticks as tick (tick)}
				<span class="absolute right-0 -translate-y-1/2" style="top:{yOf(tick)}px">
					{formatValue(tick)}
				</span>
			{/each}
		</div>

		<div class="relative min-w-0 flex-1">
			<svg
				class="w-full touch-none"
				viewBox="0 0 {WIDTH} {height}"
				preserveAspectRatio="none"
				style="height:{height}px"
				role="img"
				aria-label="Duration across the last {points.length} runs"
				onpointermove={onmove}
				onpointerleave={() => (hovered = null)}
			>
				{#each scale.ticks as tick (tick)}
					<line
						x1="0"
						y1={yOf(tick)}
						x2={WIDTH}
						y2={yOf(tick)}
						stroke="var(--viz-grid)"
						stroke-width="1"
						vector-effect="non-scaling-stroke"
					/>
				{/each}

				<path d={areaPath} fill="var(--viz-series-wash)" />

				{#if active}
					<line
						x1={active.x}
						y1={PAD_Y - 8}
						x2={active.x}
						y2={height - PAD_Y + 8}
						stroke="var(--app-border-strong)"
						stroke-width="1"
						vector-effect="non-scaling-stroke"
					/>
				{/if}

				<path
					d={linePath}
					fill="none"
					stroke="var(--viz-series)"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			</svg>

			<!--
				The marker is an HTML element, not an SVG circle: the viewBox is
				stretched horizontally to fill its container, which would squash a
				circle into an ellipse.
			-->
			{#if marker}
				<span
					class="pointer-events-none absolute size-[9px] rounded-full border-2 border-[var(--app-surface)] bg-[var(--viz-series)]"
					style="left:clamp(0px, {(marker.x / WIDTH) *
						100}%, calc(100% - 9px));top:{marker.y}px;margin-left:-4.5px;margin-top:-4.5px"
				></span>
			{/if}

			{#if active}
				<div
					class="bg-surface-raised border-line shadow-float pointer-events-none absolute top-0 z-10 w-max max-w-[11rem] rounded-lg border px-2.5 py-1.5"
					style="left:clamp(0px, {(active.x / WIDTH) * 100}% - 3rem, calc(100% - 7rem))"
				>
					<p class="text-ink-subtle text-[10px] whitespace-nowrap">{active.point.label}</p>
					<p class="text-ink tabular text-xs font-semibold whitespace-nowrap">
						{formatValue(active.point.value)}
					</p>
					{#if active.point.caption}
						<p class="text-ink-subtle text-[10px] whitespace-nowrap">{active.point.caption}</p>
					{/if}
				</div>
			{:else if last}
				<!-- Direct label on the value that matters most: the latest run -->
				<span
					class="text-ink tabular pointer-events-none absolute right-0 rounded bg-[var(--app-surface)] px-1 text-[11px] font-semibold"
					style="top:{Math.max(0, last.y - 22)}px"
				>
					{formatValue(last.point.value)}
				</span>
			{/if}

			<div class="text-ink-subtle mt-1 flex justify-between text-[10px]">
				<span>{points[0]?.label}</span>
				<span>{points[points.length - 1]?.label}</span>
			</div>
		</div>
	</div>
{/if}
