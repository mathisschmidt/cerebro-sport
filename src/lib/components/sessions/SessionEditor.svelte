<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Exercise } from '$domain/models/exercise.ts';
	import type { SessionDetail } from '$domain/models/session.ts';
	import {
		draftFromSession,
		draftToInput,
		draftToPreview,
		emptyBlock,
		emptyDraft,
		emptyItem,
		draftKey,
		move,
		validateDraft,
		type SessionDraft
	} from '$domain/services/session-draft.ts';
	import { api, ApiError } from '$client/api.ts';
	import { toasts } from '$client/toast.svelte.ts';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Field from '$components/ui/Field.svelte';
	import TextArea from '$components/ui/TextArea.svelte';
	import TextInput from '$components/ui/TextInput.svelte';
	import ExerciseForm from '$components/exercises/ExerciseForm.svelte';
	import BlockEditor from './BlockEditor.svelte';
	import ExercisePicker from './ExercisePicker.svelte';
	import PlanPreview from './PlanPreview.svelte';

	interface Props {
		/** Absent when creating. */
		session?: SessionDetail | null;
		exercises: Exercise[];
	}

	let { session = null, exercises: initialExercises }: Props = $props();

	/**
	 * Both are seeded once and then owned by the editor: re-deriving the draft
	 * from the prop would throw away everything typed since the page loaded.
	 */
	// svelte-ignore state_referenced_locally
	let draft = $state<SessionDraft>(session ? draftFromSession(session) : emptyDraft());
	// svelte-ignore state_referenced_locally
	let library = $state<Exercise[]>(initialExercises);
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);

	let pickerOpen = $state(false);
	let pickerBlockIndex = $state(0);
	let exerciseFormOpen = $state(false);

	const byId = $derived(new Map(library.map((exercise) => [exercise.id, exercise])));
	const preview = $derived(draftToPreview(draft, byId, session?.id ?? 'preview'));

	function openPicker(blockIndex: number) {
		pickerBlockIndex = blockIndex;
		pickerOpen = true;
	}

	function addItem(exercise: Exercise) {
		const block = draft.blocks[pickerBlockIndex];
		if (!block) return;
		block.items = [...block.items, emptyItem(exercise.id, exercise.defaultMeasure)];
	}

	function addBlock() {
		draft.blocks = [...draft.blocks, emptyBlock()];
	}

	function duplicateBlock(index: number) {
		const block = draft.blocks[index];
		if (!block) return;
		const copy = {
			...block,
			key: draftKey('b'),
			items: block.items.map((item) => ({ ...item, key: draftKey('i') }))
		};
		draft.blocks = [...draft.blocks.slice(0, index + 1), copy, ...draft.blocks.slice(index + 1)];
	}

	async function save() {
		errors = validateDraft(draft);
		if (Object.keys(errors).length > 0) {
			toasts.error('Fix the highlighted fields first');
			return;
		}

		saving = true;
		try {
			const input = draftToInput(draft);
			const saved = session
				? await api.sessions.update(session.id, input)
				: await api.sessions.create(input);
			toasts.success(session ? 'Session saved' : 'Session created');
			await goto(`/library/sessions/${saved.id}`, { invalidateAll: true });
		} catch (error) {
			if (error instanceof ApiError) {
				errors = error.fields;
				toasts.error(error.message);
			} else {
				toasts.error('Could not save the session');
			}
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
	<div class="flex min-w-0 flex-1 flex-col gap-4">
		<Card>
			<div class="flex flex-col gap-4">
				<Field label="Session name" required error={errors.name} for="session-name">
					<TextInput
						id="session-name"
						bind:value={draft.name}
						placeholder="Full body circuit"
						invalid={Boolean(errors.name)}
						autocomplete="off"
					/>
				</Field>
				<Field label="Description" for="session-description">
					<TextArea
						id="session-description"
						bind:value={draft.description}
						rows={2}
						placeholder="Conditioning session, no equipment."
					/>
				</Field>
			</div>
		</Card>

		{#each draft.blocks as block, blockIndex (block.key)}
			<BlockEditor
				bind:block={draft.blocks[blockIndex]!}
				index={blockIndex}
				total={draft.blocks.length}
				exercises={byId}
				error={errors[`blocks.${blockIndex}`]}
				onmove={(direction) => (draft.blocks = move(draft.blocks, blockIndex, blockIndex + direction))}
				onremove={() => (draft.blocks = draft.blocks.filter((entry) => entry.key !== block.key))}
				onduplicate={() => duplicateBlock(blockIndex)}
				onadditem={() => openPicker(blockIndex)}
			/>
		{/each}

		<Button variant="outline" icon="plus" onclick={addBlock} class="self-start">Add block</Button>
	</div>

	<!-- Sticky on desktop so the shape of the session stays visible while editing -->
	<aside class="lg:sticky lg:top-8 lg:w-80 lg:shrink-0">
		<Card>
			<h2 class="text-ink mb-3 text-[13px] font-semibold">Preview</h2>
			<PlanPreview session={preview} />
		</Card>

		<div class="mt-3 flex gap-2 max-lg:hidden">
			<Button variant="primary" full loading={saving} onclick={save}>
				{session ? 'Save changes' : 'Create session'}
			</Button>
		</div>
	</aside>
</div>

<!-- Mobile save bar: the primary action must always be within thumb reach -->
<div
	class="border-line bg-bg/95 pb-safe fixed inset-x-0 bottom-16 z-20 border-t px-4 py-2.5 backdrop-blur-md lg:hidden"
>
	<Button variant="primary" full size="lg" loading={saving} onclick={save}>
		{session ? 'Save changes' : 'Create session'}
	</Button>
</div>

<ExercisePicker
	bind:open={pickerOpen}
	exercises={library}
	onpick={addItem}
	oncreate={() => (exerciseFormOpen = true)}
/>

<ExerciseForm
	bind:open={exerciseFormOpen}
	{library}
	onsaved={(exercise) => {
		library = [...library, exercise].sort((a, b) => a.name.localeCompare(b.name));
		addItem(exercise);
	}}
/>
