<script lang="ts">
	import type { Exercise, ExerciseCategory, ExerciseInput } from '$domain/models/exercise.ts';
	import {
		EXERCISE_CATEGORY_LABEL,
		customCategoriesOf,
		exerciseCategorySchema
	} from '$domain/models/exercise.ts';
	import type { Measure } from '$domain/models/common.ts';
	import { api, ApiError } from '$client/api.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import Button from '$components/ui/Button.svelte';
	import Field from '$components/ui/Field.svelte';
	import Modal from '$components/ui/Modal.svelte';
	import Select from '$components/ui/Select.svelte';
	import TextArea from '$components/ui/TextArea.svelte';
	import TextInput from '$components/ui/TextInput.svelte';
	import MeasureInput from '$components/shared/MeasureInput.svelte';

	interface Props {
		open: boolean;
		/** Absent for a new exercise. */
		exercise?: Exercise | null;
		/** The library, so a custom category already in use can be reused rather than retyped. */
		library?: readonly Pick<Exercise, 'category' | 'customCategory'>[];
		onsaved: (exercise: Exercise) => void;
	}

	let { open = $bindable(), exercise = null, library = [], onsaved }: Props = $props();

	const CATEGORIES = exerciseCategorySchema.options;
	const knownCustom = $derived(customCategoriesOf(library));

	let name = $state('');
	let description = $state('');
	let instructions = $state('');
	let category = $state<ExerciseCategory>('other');
	let customCategory = $state('');
	let tagsText = $state('');
	let hasDefault = $state(false);
	let defaultMeasure = $state<Measure>({ type: 'reps', value: 10 });
	let saving = $state(false);
	let errors = $state<Record<string, string>>({});

	// Re-seed whenever the dialog is opened, so a cancelled edit leaves nothing behind.
	$effect(() => {
		if (!open) return;
		name = exercise?.name ?? '';
		description = exercise?.description ?? '';
		instructions = exercise?.instructions ?? '';
		category = exercise?.category ?? 'other';
		customCategory = exercise?.customCategory ?? '';
		tagsText = exercise?.tags.join(', ') ?? '';
		hasDefault = Boolean(exercise?.defaultMeasure);
		defaultMeasure = exercise?.defaultMeasure ?? { type: 'reps', value: 10 };
		errors = {};
	});

	async function save() {
		saving = true;
		errors = {};
		const input: ExerciseInput = {
			name: name.trim(),
			description: description.trim(),
			instructions: instructions.trim(),
			category,
			// Only an `other` with something typed in it becomes a category of its
			// own; anything else stays plain "Other".
			customCategory: category === 'other' && customCategory.trim() ? customCategory.trim() : null,
			tags: tagsText
				.split(',')
				.map((tag) => tag.trim())
				.filter(Boolean),
			defaultMeasure: hasDefault ? defaultMeasure : null
		};

		try {
			const saved = exercise
				? await api.exercises.update(exercise.id, input)
				: await api.exercises.create(input);
			toasts.success(exercise ? 'Exercise updated' : 'Exercise created');
			onsaved(saved);
			open = false;
		} catch (error) {
			if (error instanceof ApiError) {
				errors = error.fields;
				if (Object.keys(error.fields).length === 0) toasts.error(error.message);
			} else {
				toasts.error('Could not save the exercise');
			}
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	bind:open
	title={exercise ? 'Edit exercise' : 'New exercise'}
	subtitle="A movement you can drop into any session."
>
	<div class="flex flex-col gap-4">
		<Field label="Name" required error={errors.name} for="exercise-name">
			<TextInput
				id="exercise-name"
				bind:value={name}
				placeholder="Pull-up"
				invalid={Boolean(errors.name)}
				autocomplete="off"
			/>
		</Field>

		<div class="grid gap-4 sm:grid-cols-2">
			<Field label="Category" for="exercise-category">
				<Select id="exercise-category" bind:value={category}>
					{#each CATEGORIES as option (option)}
						<option value={option}>{EXERCISE_CATEGORY_LABEL[option]}</option>
					{/each}
				</Select>
			</Field>

			<Field label="Tags" hint="Comma separated" for="exercise-tags">
				<TextInput id="exercise-tags" bind:value={tagsText} placeholder="upper body, calisthenics" />
			</Field>

			{#if category === 'other'}
				<Field
					label="Category name"
					hint="Optional — leave it empty to stay in Other"
					error={errors.customCategory}
					for="exercise-custom-category"
					class="sm:col-span-2"
				>
					<TextInput
						id="exercise-custom-category"
						bind:value={customCategory}
						placeholder="Recovery"
						list="exercise-custom-categories"
						invalid={Boolean(errors.customCategory)}
						autocomplete="off"
						maxlength={40}
					/>
					<datalist id="exercise-custom-categories">
						{#each knownCustom as known (known)}
							<option value={known}></option>
						{/each}
					</datalist>
				</Field>
			{/if}
		</div>

		<Field label="Description" hint="What the movement is" for="exercise-description">
			<TextArea
				id="exercise-description"
				bind:value={description}
				rows={2}
				placeholder="Vertical pull from a dead hang."
			/>
		</Field>

		<Field label="How to do it" hint="Shown while you run the exercise" for="exercise-instructions">
			<TextArea
				id="exercise-instructions"
				bind:value={instructions}
				rows={3}
				placeholder="Grip slightly wider than shoulders. Pull until the chin passes the bar, lower under control."
			/>
		</Field>

		<div class="border-line rounded-xl border p-3">
			<label class="flex cursor-pointer items-center gap-2.5">
				<input
					type="checkbox"
					bind:checked={hasDefault}
					class="accent-accent size-4 rounded"
				/>
				<span class="text-ink text-[13px] font-medium">Default amount</span>
				<span class="text-ink-subtle text-[12px]">pre-fills the session editor</span>
			</label>
			{#if hasDefault}
				<div class="mt-3">
					<MeasureInput bind:measure={defaultMeasure} />
				</div>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" loading={saving} onclick={save}>
			{exercise ? 'Save changes' : 'Create exercise'}
		</Button>
	{/snippet}
</Modal>
