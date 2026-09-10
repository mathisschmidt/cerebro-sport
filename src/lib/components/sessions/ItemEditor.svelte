<script lang="ts">
	import type { Exercise } from '$domain/models/exercise.ts';
	import type { DraftItem } from '$domain/services/session-draft.ts';
	import Icon from '$components/ui/Icon.svelte';
	import TextInput from '$components/ui/TextInput.svelte';
	import Field from '$components/ui/Field.svelte';
	import MeasureInput from '$components/shared/MeasureInput.svelte';
	import RestInput from '$components/shared/RestInput.svelte';

	interface Props {
		item: DraftItem;
		index: number;
		total: number;
		exercise: Exercise | undefined;
		onmove: (direction: -1 | 1) => void;
		onremove: () => void;
	}

	let { item = $bindable(), index, total, exercise, onmove, onremove }: Props = $props();

	let expanded = $state(false);
</script>

<div class="border-line bg-surface-sunken/40 rounded-xl border">
	<div class="flex items-center gap-2 p-2.5 sm:p-3">
		<span
			class="bg-surface-raised text-ink-subtle tabular grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold"
		>
			{index + 1}
		</span>

		<div class="min-w-0 flex-1">
			<p class="text-ink truncate text-[13px] font-medium">
				{exercise?.name ?? 'Unknown exercise'}
			</p>
			<p class="text-ink-subtle truncate text-[11px]">
				{item.restAfterSec > 0 ? `then ${item.restAfterSec}s rest` : 'no rest after'}
				{#if item.targetLoad}· {item.targetLoad}{/if}
			</p>
		</div>

		<div class="flex shrink-0 items-center">
			<button
				type="button"
				class="text-ink-subtle hover:text-ink hover:bg-surface-raised grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-25"
				onclick={() => onmove(-1)}
				disabled={index === 0}
				aria-label="Move up"
			>
				<Icon name="chevronUp" size={15} />
			</button>
			<button
				type="button"
				class="text-ink-subtle hover:text-ink hover:bg-surface-raised grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-25"
				onclick={() => onmove(1)}
				disabled={index === total - 1}
				aria-label="Move down"
			>
				<Icon name="chevronDown" size={15} />
			</button>
			<button
				type="button"
				class="text-ink-subtle hover:text-ink hover:bg-surface-raised grid size-8 place-items-center rounded-lg transition-colors"
				onclick={() => (expanded = !expanded)}
				aria-label="More options"
				aria-expanded={expanded}
			>
				<Icon name="settings" size={15} />
			</button>
			<button
				type="button"
				class="text-ink-subtle hover:text-danger hover:bg-danger/10 grid size-8 place-items-center rounded-lg transition-colors"
				onclick={onremove}
				aria-label="Remove {exercise?.name ?? 'exercise'}"
			>
				<Icon name="close" size={15} />
			</button>
		</div>
	</div>

	<!--
		One measure editor, on its own row: inline on a wide screen, stacked on a
		phone. Two instances bound to the same measure would each run their own
		type-sync effect against the other.
	-->
	<div class="px-2.5 pb-2.5 sm:px-3 sm:pb-3">
		<MeasureInput bind:measure={item.measure} />
	</div>

	{#if expanded}
		<div class="border-line grid gap-3 border-t p-2.5 sm:grid-cols-2 sm:p-3">
			<Field label="Rest after this exercise">
				<RestInput bind:seconds={item.restAfterSec} />
			</Field>
			<Field label="Target load" hint="Weight, band, incline — anything">
				<TextInput bind:value={item.targetLoad} placeholder="20 kg" />
			</Field>
			<Field label="Note" class="sm:col-span-2">
				<TextInput bind:value={item.notes} placeholder="Slow eccentric" />
			</Field>
		</div>
	{/if}
</div>
