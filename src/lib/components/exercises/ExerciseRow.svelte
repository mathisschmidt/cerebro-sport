<script lang="ts">
	import type { ExerciseWithUsage } from '$domain/models/exercise.ts';
	import { exerciseCategoryLabel } from '$domain/models/exercise.ts';
	import { formatMeasure } from '$domain/models/common.ts';
	import Badge from '$components/ui/Badge.svelte';
	import Icon from '$components/ui/Icon.svelte';

	interface Props {
		exercise: ExerciseWithUsage;
		onedit: () => void;
		ondelete: () => void;
	}

	let { exercise, onedit, ondelete }: Props = $props();

	let expanded = $state(false);
	const hasDetail = $derived(Boolean(exercise.description || exercise.instructions));
</script>

<div class="card p-0">
	<div class="flex items-start gap-3 p-3.5 sm:p-4">
		<button
			type="button"
			class="min-w-0 flex-1 text-left"
			onclick={() => (expanded = hasDetail ? !expanded : expanded)}
			aria-expanded={hasDetail ? expanded : undefined}
		>
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-ink text-sm font-semibold">{exercise.name}</span>
				<Badge>{exerciseCategoryLabel(exercise)}</Badge>
				{#if exercise.defaultMeasure}
					<Badge tone="accent">{formatMeasure(exercise.defaultMeasure)}</Badge>
				{/if}
			</div>
			{#if exercise.description}
				<p class="text-ink-muted mt-1 line-clamp-2 text-[13px] leading-snug">
					{exercise.description}
				</p>
			{/if}
			<div class="text-ink-subtle mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
				<span>
					{exercise.sessionCount === 0
						? 'Not used yet'
						: `In ${exercise.sessionCount} session${exercise.sessionCount > 1 ? 's' : ''}`}
				</span>
				{#each exercise.tags as tag (tag)}
					<span class="bg-surface-sunken rounded px-1.5 py-0.5">{tag}</span>
				{/each}
			</div>
		</button>

		<div class="flex shrink-0 items-center gap-0.5">
			<button
				type="button"
				class="text-ink-subtle hover:text-ink hover:bg-surface-sunken grid size-9 place-items-center rounded-lg transition-colors"
				onclick={onedit}
				aria-label="Edit {exercise.name}"
			>
				<Icon name="pencil" size={16} />
			</button>
			<button
				type="button"
				class="text-ink-subtle hover:text-danger hover:bg-danger/10 grid size-9 place-items-center rounded-lg transition-colors"
				onclick={ondelete}
				aria-label="Delete {exercise.name}"
			>
				<Icon name="trash" size={16} />
			</button>
		</div>
	</div>

	{#if expanded && exercise.instructions}
		<div class="border-line bg-surface-sunken/50 border-t px-3.5 py-3 sm:px-4">
			<p class="text-ink-subtle mb-1 text-[11px] font-medium tracking-wide uppercase">How to do it</p>
			<p class="text-ink-muted text-[13px] leading-relaxed whitespace-pre-line">
				{exercise.instructions}
			</p>
		</div>
	{/if}
</div>
