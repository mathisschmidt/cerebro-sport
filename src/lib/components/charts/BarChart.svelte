<script lang="ts">
	/**
	 * Columns for magnitude over time. One series, one axis — never two scales.
	 * Bars cap at 24px so a short series keeps air around it, and every bar
	 * carries its own hover tooltip.
	 */
	import { durationScale } from '$domain/services/scale.ts';

	export interface BarDatum {
		label: string;
		value: number;
		/** Shown in the tooltip in place of the raw number. */
		display?: string;
		caption?: string;
	}

	interface Props {
		data: BarDatum[];
		height?: number;
		formatValue?: (value: number) => string;
		emptyLabel?: string;
	}

	let {
		data,
		height = 160,
		formatValue = (value: number) => String(value),
		emptyLabel = 'No data yet'
	}: Props = $props();

	// Bars grow from zero and the axis rounds up to a clean value, so bar
	// heights stay proportional to what the ticks claim.
	const scale = $derived(
		durationScale(0, Math.max(1, ...data.map((datum) => datum.value)), {
			ticks: 3,
			zeroBased: true
		})
	);

	let hovered = $state<number | null>(null);
</script>

{#if data.length === 0}
	<p class="text-ink-subtle py-8 text-center text-[13px]">{emptyLabel}</p>
{:else}
	<div class="flex gap-3">
		<!-- Axis ticks carry the values the bars are not directly labelled with -->
		<div
			class="text-ink-subtle tabular flex shrink-0 flex-col justify-between py-0 text-[10px]"
			style="height:{height}px"
			aria-hidden="true"
		>
			{#each scale.ticks as tick (tick)}
				<span>{formatValue(tick)}</span>
			{/each}
		</div>

		<div class="relative min-w-0 flex-1">
			<div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
				{#each scale.ticks as tick (tick)}
					<span class="bg-grid h-px w-full"></span>
				{/each}
			</div>

			<!-- 2px surface gaps between neighbours; the gap does the separating -->
			<div class="relative flex items-end gap-[2px]" style="height:{height}px">
				{#each data as datum, index (datum.label)}
					<button
						type="button"
						class="group relative flex h-full flex-1 cursor-default items-end justify-center"
						onmouseenter={() => (hovered = index)}
						onmouseleave={() => (hovered = null)}
						onfocus={() => (hovered = index)}
						onblur={() => (hovered = null)}
						aria-label="{datum.label}: {datum.display ?? formatValue(datum.value)}"
					>
						<span
							class="w-full max-w-6 rounded-t-[4px] transition-opacity"
							class:opacity-100={hovered === null || hovered === index}
							class:opacity-45={hovered !== null && hovered !== index}
							style="height:{Math.max(
								datum.value > 0 ? 3 : 0,
								(datum.value / scale.max) * 100
							)}%;background:var(--viz-series)"
						></span>

						{#if hovered === index}
							<div
								class="bg-surface-raised border-line shadow-float pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-[10rem] -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-left"
							>
								<p class="text-ink-subtle text-[10px] whitespace-nowrap">{datum.label}</p>
								<p class="text-ink tabular text-xs font-semibold whitespace-nowrap">
									{datum.display ?? formatValue(datum.value)}
								</p>
								{#if datum.caption}
									<p class="text-ink-subtle text-[10px] whitespace-nowrap">{datum.caption}</p>
								{/if}
							</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}
