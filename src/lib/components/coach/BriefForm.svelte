<script lang="ts">
	import type { CoachBrief, ExercisePolicy, Level, MeasurePreference } from '$domain/services/coach-prompt.ts';
	import ChipSelect from '$components/ui/ChipSelect.svelte';
	import Field from '$components/ui/Field.svelte';
	import NumberStepper from '$components/ui/NumberStepper.svelte';
	import SegmentedControl from '$components/ui/SegmentedControl.svelte';
	import TextArea from '$components/ui/TextArea.svelte';
	import TextInput from '$components/ui/TextInput.svelte';

	/** Everything the coach needs to know, in the order you would say it out loud. */
	interface Props {
		brief: CoachBrief;
		libraryExercises: string[];
	}

	let { brief = $bindable(), libraryExercises }: Props = $props();

	const LEVELS: Array<{ value: Level; label: string }> = [
		{ value: 'beginner', label: 'Beginner' },
		{ value: 'intermediate', label: 'Intermediate' },
		{ value: 'advanced', label: 'Advanced' }
	];

	const POLICIES: Array<{ value: ExercisePolicy; label: string }> = [
		{ value: 'library-only', label: 'My library only' },
		{ value: 'prefer-library', label: 'Prefer mine' },
		{ value: 'free', label: 'Invent freely' }
	];

	const POLICY_HINT: Record<ExercisePolicy, string> = {
		'library-only': 'Nothing new gets created — the plan is built only from exercises you already have.',
		'prefer-library': 'Reuses your exercises where they fit, adds new ones only where needed.',
		'free': 'Free to invent movements. Still reuses your names where they mean the same thing.'
	};

	const MEASURES: Array<{ value: MeasurePreference; label: string }> = [
		{ value: 'mixed', label: 'Mixed' },
		{ value: 'reps', label: 'Reps' },
		{ value: 'time', label: 'Timed' }
	];
</script>

<div class="flex flex-col gap-4">
	<Field
		label="What do you want?"
		required
		hint="Plain language. Everything below just sharpens this."
		for="brief-goal"
	>
		<TextArea
			id="brief-goal"
			bind:value={brief.goal}
			rows={3}
			placeholder="I want to get better at pull-ups and keep my conditioning up. Short sessions I can do at home before work, nothing that wakes the neighbours."
		/>
	</Field>

	<div class="grid gap-4 sm:grid-cols-2">
		<Field label="Sport or discipline" hint="Optional" for="brief-discipline">
			<TextInput
				id="brief-discipline"
				bind:value={brief.discipline}
				placeholder="Calisthenics, football, climbing…"
			/>
		</Field>
		<Field label="Level" for="brief-level">
			<SegmentedControl bind:value={brief.level} segments={LEVELS} size="sm" class="w-full" />
		</Field>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<Field label="Sessions to design" for="brief-count">
			<NumberStepper id="brief-count" bind:value={brief.sessionCount} min={1} max={20} ariaLabel="Sessions to design" />
		</Field>
		<Field label="Minutes per session" for="brief-minutes">
			<NumberStepper
				id="brief-minutes"
				bind:value={brief.minutesPerSession}
				min={5}
				max={240}
				step={5}
				suffix="min"
				ariaLabel="Minutes per session"
			/>
		</Field>
		<Field label="Days per week" for="brief-days">
			<NumberStepper id="brief-days" bind:value={brief.daysPerWeek} min={1} max={7} ariaLabel="Days per week" />
		</Field>
	</div>

	<Field label="Equipment available" hint="Optional" for="brief-equipment">
		<TextInput
			id="brief-equipment"
			bind:value={brief.equipment}
			placeholder="Pull-up bar, one kettlebell, a mat"
		/>
	</Field>

	<Field label="Constraints or injuries" hint="Optional" for="brief-constraints">
		<TextInput
			id="brief-constraints"
			bind:value={brief.constraints}
			placeholder="Dodgy left shoulder — no overhead pressing"
		/>
	</Field>

	<Field label="Exercises" hint={POLICY_HINT[brief.exercisePolicy]}>
		<SegmentedControl bind:value={brief.exercisePolicy} segments={POLICIES} size="sm" class="w-full" />
	</Field>

	<div class="grid gap-4 sm:grid-cols-2">
		<Field label="Must include" hint="Pick from your library">
			<ChipSelect bind:selected={brief.mustInclude} options={libraryExercises} emptyLabel="Your library is empty." />
		</Field>
		<Field label="Must avoid" hint="Pick from your library">
			<ChipSelect bind:selected={brief.avoid} options={libraryExercises} emptyLabel="Your library is empty." />
		</Field>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<Field label="Set style">
			<SegmentedControl bind:value={brief.measurePreference} segments={MEASURES} size="sm" class="w-full" />
		</Field>
		<Field label="Schedule">
			<label class="border-line flex h-10 cursor-pointer items-center gap-2.5 rounded-[10px] border px-3">
				<input type="checkbox" bind:checked={brief.includeRoutines} class="accent-accent size-4 rounded" />
				<span class="text-ink text-[13px]">Also plan the week as routines</span>
			</label>
		</Field>
	</div>

	<Field label="Anything else" hint="Optional" for="brief-notes">
		<TextInput id="brief-notes" bind:value={brief.notes} placeholder="Keep the warm-up short, I hate burpees" />
	</Field>
</div>
