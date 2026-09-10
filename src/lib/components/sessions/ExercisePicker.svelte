<script lang="ts">
	import type { Exercise } from '$domain/models/exercise.ts';
	import { EXERCISE_CATEGORY_LABEL } from '$domain/models/exercise.ts';
	import { formatMeasure } from '$domain/models/common.ts';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Icon from '$components/ui/Icon.svelte';
	import Modal from '$components/ui/Modal.svelte';
	import TextInput from '$components/ui/TextInput.svelte';

	/** Search-first picker — a plain <select> stops working past ~20 exercises. */
	interface Props {
		open: boolean;
		exercises: Exercise[];
		onpick: (exercise: Exercise) => void;
		oncreate?: () => void;
	}

	let { open = $bindable(), exercises, onpick, oncreate }: Props = $props();

	let search = $state('');

	const matches = $derived.by(() => {
		const term = search.trim().toLowerCase();
		if (!term) return exercises;
		return exercises.filter(
			(exercise) =>
				exercise.name.toLowerCase().includes(term) ||
				exercise.tags.some((tag) => tag.toLowerCase().includes(term)) ||
				exercise.description.toLowerCase().includes(term)
		);
	});

	$effect(() => {
		if (open) search = '';
	});

	function pick(exercise: Exercise) {
		onpick(exercise);
		open = false;
	}
</script>

<Modal bind:open title="Add an exercise" size="sm">
	<div class="flex flex-col gap-3">
		<div class="relative">
			<span class="text-ink-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
				<Icon name="search" size={16} />
			</span>
			<TextInput
				bind:value={search}
				placeholder="Search exercises…"
				class="pl-9"
				autocomplete="off"
			/>
		</div>

		{#if matches.length === 0}
			<div class="py-8 text-center">
				<p class="text-ink-muted text-[13px]">
					{exercises.length === 0 ? 'No exercises yet.' : 'Nothing matches that search.'}
				</p>
				{#if oncreate}
					<Button
						variant="secondary"
						size="sm"
						icon="plus"
						class="mt-3"
						onclick={() => {
							open = false;
							oncreate?.();
						}}
					>
						Create an exercise
					</Button>
				{/if}
			</div>
		{:else}
			<ul class="-mx-1 flex max-h-[50dvh] flex-col gap-1 overflow-y-auto px-1">
				{#each matches as exercise (exercise.id)}
					<li>
						<button
							type="button"
							class="border-line hover:border-line-strong hover:bg-surface flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
							onclick={() => pick(exercise)}
						>
							<div class="min-w-0 flex-1">
								<p class="text-ink truncate text-[13px] font-medium">{exercise.name}</p>
								<p class="text-ink-subtle truncate text-[11px]">
									{EXERCISE_CATEGORY_LABEL[exercise.category]}
									{#if exercise.description}· {exercise.description}{/if}
								</p>
							</div>
							{#if exercise.defaultMeasure}
								<Badge tone="accent">{formatMeasure(exercise.defaultMeasure)}</Badge>
							{/if}
							<span class="text-ink-subtle shrink-0"><Icon name="plus" size={16} /></span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Modal>
