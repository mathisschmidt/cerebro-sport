<script lang="ts">
	import type { DurationParts } from '$domain/models/common.ts';
	import { durationParts, secondsOf } from '$domain/models/common.ts';
	import Icon from './Icon.svelte';

	/**
	 * A duration typed the way it is said — 1 h 30 min 30 s — one column per part,
	 * each with its own + and −. Columns stack the buttons vertically so all
	 * three fit a phone.
	 *
	 * Everything works on the total in seconds, so the parts carry and borrow on
	 * their own: + on 55 s gives 1 min 00 s, − on 1 min 00 s gives 55 s. A typed
	 * part is applied when the field is left, so 90 typed in seconds becomes
	 * 1 min 30 s rather than jumping about mid-typing.
	 */
	interface Props {
		/** Total seconds. */
		value: number;
		min?: number;
		max?: number;
		id?: string;
		label?: string;
	}

	let { value = $bindable(), min = 1, max = 86_400, id, label = 'Duration' }: Props = $props();

	const COLUMNS = [
		{ part: 'hours' as const, unit: 'h', name: 'hours', step: 3600 },
		{ part: 'minutes' as const, unit: 'min', name: 'minutes', step: 60 },
		{ part: 'seconds' as const, unit: 'sec', name: 'seconds', step: 5 }
	];

	const parts = $derived(durationParts(value));

	function clamp(seconds: number): number {
		return Math.min(max, Math.max(min, Math.round(seconds)));
	}

	function nudge(seconds: number) {
		value = clamp(value + seconds);
	}

	function type(part: keyof DurationParts, input: HTMLInputElement) {
		const typed = input.valueAsNumber;
		const next = Number.isFinite(typed) ? Math.max(0, Math.floor(typed)) : 0;
		value = clamp(secondsOf({ ...parts, [part]: next }));
		// Normalised parts may differ from what was typed; show what is stored.
		input.value = String(durationParts(value)[part]);
	}
</script>

<div class="flex items-start gap-1.5" role="group" aria-label={label}>
	{#each COLUMNS as column, index (column.part)}
		<div class="flex flex-col items-center gap-1">
			<button
				type="button"
				class="text-ink-muted hover:text-ink hover:bg-surface-raised border-line grid h-8 w-14 place-items-center rounded-lg border transition-colors disabled:opacity-30"
				onclick={() => nudge(column.step)}
				disabled={value >= max}
				aria-label="Add {column.step === 5 ? '5 seconds' : `1 ${column.name.slice(0, -1)}`}"
			>
				<Icon name="plus" size={14} />
			</button>
			<label
				class="bg-surface-sunken border-line focus-within:border-accent flex h-10 w-14 items-center justify-center gap-0.5 rounded-[10px] border transition-colors"
			>
				<input
					id={index === 0 ? id : undefined}
					type="number"
					inputmode="numeric"
					min="0"
					value={column.part === 'hours' ? parts[column.part] : String(parts[column.part]).padStart(2, '0')}
					onchange={(event) => type(column.part, event.currentTarget)}
					class="tabular text-ink w-7 border-0 bg-transparent p-0 text-right text-sm outline-none
					[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					aria-label={column.name}
				/>
				<span class="text-ink-subtle text-[11px]">{column.unit}</span>
			</label>
			<button
				type="button"
				class="text-ink-muted hover:text-ink hover:bg-surface-raised border-line grid h-8 w-14 place-items-center rounded-lg border transition-colors disabled:opacity-30"
				onclick={() => nudge(-column.step)}
				disabled={value - column.step < min}
				aria-label="Remove {column.step === 5 ? '5 seconds' : `1 ${column.name.slice(0, -1)}`}"
			>
				<Icon name="minus" size={14} />
			</button>
		</div>
	{/each}
</div>
