<script lang="ts">
	import type { Recurrence, RecurrenceType } from '$domain/models/routine.ts';
	import { WEEKDAY_LABEL, describeRecurrence } from '$domain/models/routine.ts';
	import NumberStepper from '$components/ui/NumberStepper.svelte';
	import SegmentedControl from '$components/ui/SegmentedControl.svelte';

	/** The repeat rule, in the shape a task app trains people to expect. */
	interface Props {
		recurrence: Recurrence;
		/** Seeds the default weekday / day-of-month from the routine's start. */
		startDate: string;
	}

	let { recurrence = $bindable(), startDate }: Props = $props();

	const SEGMENTS = [
		{ value: 'once' as const, label: 'Once' },
		{ value: 'daily' as const, label: 'Daily' },
		{ value: 'weekly' as const, label: 'Weekly' },
		{ value: 'monthly' as const, label: 'Monthly' }
	];

	let type = $state<RecurrenceType>(recurrence.type);

	function seedWeekday(): number {
		const [year, month, day] = startDate.split('-').map(Number) as [number, number, number];
		return new Date(year, month - 1, day, 12).getDay();
	}

	function seedDayOfMonth(): number {
		return Number(startDate.split('-')[2] ?? 1);
	}

	function changeType(next: RecurrenceType) {
		switch (next) {
			case 'once':
				recurrence = { type: 'once' };
				break;
			case 'daily':
				recurrence = { type: 'daily', interval: 1 };
				break;
			case 'weekly':
				recurrence = { type: 'weekly', interval: 1, weekdays: [seedWeekday()] };
				break;
			case 'monthly':
				recurrence = { type: 'monthly', interval: 1, dayOfMonth: seedDayOfMonth() };
				break;
		}
	}

	$effect(() => {
		if (type !== recurrence.type) changeType(type);
	});
	$effect(() => {
		type = recurrence.type;
	});

	function toggleWeekday(day: number) {
		if (recurrence.type !== 'weekly') return;
		const has = recurrence.weekdays.includes(day);
		// Never let the list empty out — a weekly rule with no days never fires.
		if (has && recurrence.weekdays.length === 1) return;
		recurrence = {
			...recurrence,
			weekdays: has
				? recurrence.weekdays.filter((entry) => entry !== day)
				: [...recurrence.weekdays, day].sort((a, b) => a - b)
		};
	}

	// Monday-first display, matching how a training week is usually read.
	const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

	/**
	 * The recurrence is a discriminated union, so its numeric fields cannot be
	 * bound directly without narrowing. These proxies keep the union intact
	 * while still giving the steppers two-way binding.
	 */
	const interval = {
		get value() {
			return recurrence.type === 'once' ? 1 : recurrence.interval;
		},
		set value(next: number) {
			if (recurrence.type !== 'once') recurrence = { ...recurrence, interval: next };
		}
	};

	const dayOfMonth = {
		get value() {
			return recurrence.type === 'monthly' ? recurrence.dayOfMonth : 1;
		},
		set value(next: number) {
			if (recurrence.type === 'monthly') recurrence = { ...recurrence, dayOfMonth: next };
		}
	};
</script>

<div class="flex flex-col gap-3">
	<SegmentedControl bind:value={type} segments={SEGMENTS} size="sm" class="w-full" />

	{#if recurrence.type === 'daily'}
		<div class="flex items-center gap-2">
			<span class="text-ink-muted text-[13px]">Every</span>
			<NumberStepper bind:value={interval.value} min={1} max={365} ariaLabel="Day interval" class="w-28" />
			<span class="text-ink-muted text-[13px]">day(s)</span>
		</div>
	{:else if recurrence.type === 'weekly'}
		<div class="flex flex-col gap-3">
			<div class="flex flex-wrap gap-1.5">
				{#each WEEK_ORDER as day (day)}
					<button
						type="button"
						class="h-9 w-11 rounded-lg border text-[12px] font-medium transition-colors
						{recurrence.weekdays.includes(day)
							? 'border-accent bg-accent-soft text-accent'
							: 'border-line text-ink-muted hover:border-line-strong hover:text-ink'}"
						onclick={() => toggleWeekday(day)}
						aria-pressed={recurrence.weekdays.includes(day)}
					>
						{WEEKDAY_LABEL[day]}
					</button>
				{/each}
			</div>
			<div class="flex items-center gap-2">
				<span class="text-ink-muted text-[13px]">Every</span>
				<NumberStepper bind:value={interval.value} min={1} max={52} ariaLabel="Week interval" class="w-28" />
				<span class="text-ink-muted text-[13px]">week(s)</span>
			</div>
		</div>
	{:else if recurrence.type === 'monthly'}
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-ink-muted text-[13px]">On day</span>
			<NumberStepper bind:value={dayOfMonth.value} min={1} max={31} ariaLabel="Day of month" class="w-28" />
			<span class="text-ink-muted text-[13px]">every</span>
			<NumberStepper bind:value={interval.value} min={1} max={24} ariaLabel="Month interval" class="w-28" />
			<span class="text-ink-muted text-[13px]">month(s)</span>
		</div>
	{/if}

	<p class="text-ink-subtle text-[12px]">{describeRecurrence(recurrence)}</p>
</div>
