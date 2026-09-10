<script lang="ts">
	import type { CalendarDay } from '$domain/models/metrics.ts';
	import { formatDateLabel } from '$domain/services/date.ts';

	/**
	 * Training calendar. Magnitude is a single-hue ramp validated for this
	 * surface; "nothing scheduled" is the sunken surface rather than a ramp step,
	 * and a missed day is outlined so it never reads as merely quiet.
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

	function level(day: CalendarDay): number {
		if (day.workouts >= 3) return 4;
		if (day.workouts === 2) return 3;
		if (day.workouts === 1) return 2;
		if (day.completed > 0) return 1;
		return 0;
	}

	function fill(day: CalendarDay): string {
		const step = level(day);
		return step === 0 ? 'var(--app-surface-sunken)' : `var(--viz-ramp-${step})`;
	}

	function missed(day: CalendarDay): boolean {
		return day.due > 0 && day.completed < day.due && day.workouts === 0;
	}

	function describe(day: CalendarDay): string {
		const parts = [formatDateLabel(day.date)];
		parts.push(day.workouts === 1 ? '1 workout' : `${day.workouts} workouts`);
		if (day.due > 0) parts.push(`${day.completed}/${day.due} scheduled done`);
		return parts.join(' · ');
	}

	let hovered = $state<CalendarDay | null>(null);
</script>

<div class="relative">
	<div class="scrollbar-none -mx-1 overflow-x-auto px-1 pb-1">
		<div class="flex gap-[3px]">
			{#each columns as column, columnIndex (columnIndex)}
				<div class="flex flex-col gap-[3px]">
					{#each column as day (day.date)}
						<button
							type="button"
							class="size-[11px] shrink-0 cursor-default rounded-[3px] transition-transform hover:scale-125 sm:size-[13px]"
							style="background:{fill(day)}{missed(day)
								? ';box-shadow:inset 0 0 0 1px var(--app-danger)'
								: ''}"
							onmouseenter={() => (hovered = day)}
							onmouseleave={() => (hovered = null)}
							onfocus={() => (hovered = day)}
							onblur={() => (hovered = null)}
							aria-label={describe(day)}
						></button>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<div class="mt-2.5 flex items-center justify-between gap-3">
		<p class="text-ink-subtle h-4 truncate text-[11px]">
			{hovered ? describe(hovered) : `Last ${columns.length} weeks`}
		</p>
		<div class="text-ink-subtle flex shrink-0 items-center gap-1 text-[10px]">
			<span>Less</span>
			<span class="size-[10px] rounded-[3px]" style="background:var(--app-surface-sunken)"></span>
			{#each [1, 2, 3, 4] as step (step)}
				<span class="size-[10px] rounded-[3px]" style="background:var(--viz-ramp-{step})"></span>
			{/each}
			<span>More</span>
		</div>
	</div>
</div>
