<script lang="ts">
	import type { Exercise } from '$domain/models/exercise.ts';
	import type { DraftBlock } from '$domain/services/session-draft.ts';
	import { move } from '$domain/services/session-draft.ts';
	import Button from '$components/ui/Button.svelte';
	import Field from '$components/ui/Field.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import NumberStepper from '$components/ui/NumberStepper.svelte';
	import TextInput from '$components/ui/TextInput.svelte';
	import RestInput from '$components/shared/RestInput.svelte';
	import ItemEditor from './ItemEditor.svelte';

	/**
	 * One circuit: a list of exercises repeated `rounds` times. Nesting stops
	 * here on purpose — deeper structures are rarely written down and would cost
	 * far more in editor complexity than they buy.
	 */
	interface Props {
		block: DraftBlock;
		index: number;
		total: number;
		exercises: Map<string, Exercise>;
		error?: string;
		onmove: (direction: -1 | 1) => void;
		onremove: () => void;
		onduplicate: () => void;
		onadditem: () => void;
	}

	let {
		block = $bindable(),
		index,
		total,
		exercises,
		error,
		onmove,
		onremove,
		onduplicate,
		onadditem
	}: Props = $props();

	let showSettings = $state(false);
</script>

<section class="card p-0 {error ? 'border-danger' : ''}">
	<header class="flex flex-wrap items-center gap-2 p-3 sm:p-4">
		<span
			class="bg-accent-soft text-accent grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold"
		>
			{index + 1}
		</span>

		<TextInput
			bind:value={block.label}
			placeholder="Block {index + 1}"
			class="h-9 min-w-0 flex-1 sm:max-w-xs"
			aria-label="Block name"
		/>

		<div class="flex items-center gap-1.5">
			<span class="text-ink-muted text-[12px] font-medium">Rounds</span>
			<NumberStepper
				bind:value={block.rounds}
				min={1}
				max={100}
				ariaLabel="Rounds"
				class="w-28"
			/>
		</div>

		<div class="ml-auto flex items-center">
			<button
				type="button"
				class="text-ink-subtle hover:text-ink hover:bg-surface-sunken grid size-8 place-items-center rounded-lg transition-colors"
				onclick={() => (showSettings = !showSettings)}
				aria-label="Block rest settings"
				aria-expanded={showSettings}
			>
				<Icon name="timer" size={16} />
			</button>
			<button
				type="button"
				class="text-ink-subtle hover:text-ink hover:bg-surface-sunken grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-25"
				onclick={() => onmove(-1)}
				disabled={index === 0}
				aria-label="Move block up"
			>
				<Icon name="chevronUp" size={16} />
			</button>
			<button
				type="button"
				class="text-ink-subtle hover:text-ink hover:bg-surface-sunken grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-25"
				onclick={() => onmove(1)}
				disabled={index === total - 1}
				aria-label="Move block down"
			>
				<Icon name="chevronDown" size={16} />
			</button>
			<button
				type="button"
				class="text-ink-subtle hover:text-ink hover:bg-surface-sunken grid size-8 place-items-center rounded-lg transition-colors"
				onclick={onduplicate}
				aria-label="Duplicate block"
			>
				<Icon name="copy" size={16} />
			</button>
			<button
				type="button"
				class="text-ink-subtle hover:text-danger hover:bg-danger/10 grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-25"
				onclick={onremove}
				disabled={total === 1}
				aria-label="Delete block"
			>
				<Icon name="trash" size={16} />
			</button>
		</div>
	</header>

	{#if showSettings}
		<div class="border-line grid gap-3 border-t px-3 py-3 sm:grid-cols-2 sm:px-4">
			<Field label="Rest between rounds" hint="Used after the last exercise of a round">
				<RestInput bind:seconds={block.restBetweenRoundsSec} />
			</Field>
			<Field label="Rest after this block" hint="Skipped when it is the last block">
				<RestInput bind:seconds={block.restAfterSec} presets={[0, 30, 60, 120, 180]} />
			</Field>
		</div>
	{/if}

	<div class="flex flex-col gap-2 px-3 pb-3 sm:px-4 sm:pb-4">
		{#if block.items.length === 0}
			<p
				class="border-line text-ink-subtle rounded-xl border border-dashed px-3 py-6 text-center text-[13px]"
			>
				No exercises in this block yet.
			</p>
		{:else}
			{#each block.items as item, itemIndex (item.key)}
				<ItemEditor
					bind:item={block.items[itemIndex]!}
					index={itemIndex}
					total={block.items.length}
					exercise={exercises.get(item.exerciseId)}
					onmove={(direction) => (block.items = move(block.items, itemIndex, itemIndex + direction))}
					onremove={() => (block.items = block.items.filter((entry) => entry.key !== item.key))}
				/>
			{/each}
		{/if}

		<Button variant="outline" size="sm" icon="plus" onclick={onadditem} class="self-start">
			Add exercise
		</Button>

		{#if error}
			<p class="text-danger text-xs">{error}</p>
		{/if}
	</div>
</section>
