<script lang="ts">
	import type { CalendarDay, CalendarDayState } from '$domain/models/metrics.ts';
	import { formatDateLabel } from '$domain/services/date.ts';

	/**
	 * Training calendar. Three states and nothing else: trained (green, planned
	 * or not), missed (red), and nothing planned nor done (the empty cell). The
	 * state itself is decided in `buildStreakMetrics`, not here.
	 *
	 * The green/red pair is the status pair from `app.css`, validated for
	 * colour-blind separation in both themes — re-run the dataviz validator if
	 * either changes. Each cell's label states the day and its state, so the
	 * colour is never the only carrier.
	 */
	interface Props {
		days: CalendarDay[];
		weeks?: number;
	}

	let { days, weeks = 13 }: Props = $props();

	const visible = $derived(days.slice(-weeks * 7));

	/** Columns of 7, oldest first, so the grid reads left to right by week. */
	const columns = $derived.by(() => {
		const result: CalendarDay[][] = [];
		for (let i = 0; i < visible.length; i += 7) result.push(visible.slice(i, i + 7));
		return result;
	});

	const FILL: Record<CalendarDayState, string> = {
		trained: 'var(--viz-good)',
		missed: 'var(--viz-critical)',
		idle: 'var(--app-surface-sunken)'
	};

	const LABEL: Record<CalendarDayState, string> = {
		trained: 'trained',
		missed: 'missed',
		idle: 'nothing planned'
	};

	function describe(day: CalendarDay): string {
		return `${formatDateLabel(day.date)} · ${LABEL[day.state]}`;
	}
</script>

<div class="scrollbar-none -mx-1 overflow-x-auto px-1 pb-1">
	<div class="flex gap-[3px]" role="list" aria-label="Training calendar, last {columns.length} weeks">
		{#each columns as column, columnIndex (columnIndex)}
			<div class="flex flex-col gap-[3px]">
				{#each column as day (day.date)}
					<span
						role="listitem"
						class="size-[11px] shrink-0 rounded-[3px] sm:size-[13px]"
						style="background:{FILL[day.state]}"
						title={describe(day)}
						aria-label={describe(day)}
					></span>
				{/each}
			</div>
		{/each}
	</div>
</div>
