<script lang="ts">
	import {
		BRIEF_DEFAULTS,
		setBriefOption,
		type BriefOption,
		type CoachBrief,
		type ExercisePolicy,
		type Level,
		type MeasurePreference
	} from '$domain/services/coach-prompt.ts';
	import ChipSelect from '$components/ui/ChipSelect.svelte';
	import Field from '$components/ui/Field.svelte';
	import NumberStepper from '$components/ui/NumberStepper.svelte';
	import SegmentedControl from '$components/ui/SegmentedControl.svelte';
	import TextArea from '$components/ui/TextArea.svelte';
	import TextInput from '$components/ui/TextInput.svelte';
	import ToggleChip from '$components/ui/ToggleChip.svelte';

	/**
	 * The goal is the only thing always on screen. Every other option is a chip
	 * you switch on when you have something to say about it, and only then does
	 * its input appear — so the form stays as small as the question being asked.
	 */
	interface Props {
		brief: CoachBrief;
		libraryExercises: string[];
	}

	let { brief = $bindable(), libraryExercises }: Props = $props();

	/** `includeRoutines` is a plain yes/no, so it rides along with no input. */
	type RailKey = BriefOption | 'includeRoutines';

	const RAIL: Array<{ key: RailKey; label: string }> = [
		{ key: 'sessionCount', label: 'Sessions to design' },
		{ key: 'minutesPerSession', label: 'Minutes per session' },
		{ key: 'daysPerWeek', label: 'Days per week' },
		{ key: 'includeRoutines', label: 'Weekly schedule' },
		{ key: 'discipline', label: 'Sport' },
		{ key: 'level', label: 'Level' },
		{ key: 'equipment', label: 'Equipment' },
		{ key: 'constraints', label: 'Constraints' },
		{ key: 'exercisePolicy', label: 'Exercise sources' },
		{ key: 'mustInclude', label: 'Must include' },
		{ key: 'avoid', label: 'Must avoid' },
		{ key: 'measurePreference', label: 'Set style' },
		{ key: 'notes', label: 'Anything else' }
	];

	function isOn(key: RailKey): boolean {
		return key === 'includeRoutines' ? brief.includeRoutines : brief[key] !== null;
	}

	function flip(key: RailKey) {
		if (key === 'includeRoutines') {
			brief.includeRoutines = !brief.includeRoutines;
			return;
		}
		brief = setBriefOption(brief, key, !isOn(key));
	}

	/**
	 * A null-free view of one option so an input can bind straight to it — the
	 * `{#if}` guarding the input already proves it is on. Same get/set proxy as
	 * `RecurrenceEditor`, rather than narrowing at each binding.
	 */
	function view<K extends BriefOption>(key: K) {
		return {
			get value(): NonNullable<CoachBrief[K]> {
				return brief[key] ?? BRIEF_DEFAULTS[key];
			},
			set value(next: NonNullable<CoachBrief[K]>) {
				brief[key] = next;
			}
		};
	}

	const field = {
		discipline: view('discipline'),
		level: view('level'),
		sessionCount: view('sessionCount'),
		minutesPerSession: view('minutesPerSession'),
		daysPerWeek: view('daysPerWeek'),
		equipment: view('equipment'),
		constraints: view('constraints'),
		exercisePolicy: view('exercisePolicy'),
		mustInclude: view('mustInclude'),
		avoid: view('avoid'),
		measurePreference: view('measurePreference'),
		notes: view('notes')
	};

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

	<Field label="Add only what matters" hint="Tap an option to answer it. Anything left off is left to the coach.">
		<div class="flex flex-wrap gap-1.5">
			{#each RAIL as option (option.key)}
				<ToggleChip active={isOn(option.key)} onclick={() => flip(option.key)}>
					{option.label}
				</ToggleChip>
			{/each}
		</div>
	</Field>

	{#if RAIL.some((option) => isOn(option.key))}
		<div class="border-line grid gap-4 border-t pt-4 sm:grid-cols-2">
			{#if brief.sessionCount !== null}
				<Field label="Sessions to design" for="brief-count">
					<NumberStepper
						id="brief-count"
						bind:value={field.sessionCount.value}
						min={1}
						max={20}
						ariaLabel="Sessions to design"
					/>
				</Field>
			{/if}

			{#if brief.minutesPerSession !== null}
				<Field label="Minutes per session" for="brief-minutes">
					<NumberStepper
						id="brief-minutes"
						bind:value={field.minutesPerSession.value}
						min={5}
						max={240}
						step={5}
						suffix="min"
						ariaLabel="Minutes per session"
					/>
				</Field>
			{/if}

			{#if brief.daysPerWeek !== null}
				<Field label="Days per week" for="brief-days">
					<NumberStepper
						id="brief-days"
						bind:value={field.daysPerWeek.value}
						min={1}
						max={7}
						ariaLabel="Days per week"
					/>
				</Field>
			{/if}

			{#if brief.discipline !== null}
				<Field label="Sport or discipline" for="brief-discipline">
					<TextInput
						id="brief-discipline"
						bind:value={field.discipline.value}
						placeholder="Calisthenics, football, climbing…"
					/>
				</Field>
			{/if}

			{#if brief.level !== null}
				<Field label="Level" for="brief-level">
					<SegmentedControl
						bind:value={field.level.value}
						segments={LEVELS}
						size="sm"
						class="w-full"
					/>
				</Field>
			{/if}

			{#if brief.equipment !== null}
				<Field label="Equipment available" for="brief-equipment" class="sm:col-span-2">
					<TextInput
						id="brief-equipment"
						bind:value={field.equipment.value}
						placeholder="Pull-up bar, one kettlebell, a mat"
					/>
				</Field>
			{/if}

			{#if brief.constraints !== null}
				<Field label="Constraints or injuries" for="brief-constraints" class="sm:col-span-2">
					<TextInput
						id="brief-constraints"
						bind:value={field.constraints.value}
						placeholder="Dodgy left shoulder — no overhead pressing"
					/>
				</Field>
			{/if}

			{#if brief.exercisePolicy !== null}
				<Field
					label="Exercise sources"
					hint={POLICY_HINT[field.exercisePolicy.value]}
					class="sm:col-span-2"
				>
					<SegmentedControl
						bind:value={field.exercisePolicy.value}
						segments={POLICIES}
						size="sm"
						class="w-full"
					/>
				</Field>
			{/if}

			{#if brief.mustInclude !== null}
				<Field label="Must include" hint="Pick from your library">
					<ChipSelect
						bind:selected={field.mustInclude.value}
						options={libraryExercises}
						emptyLabel="Your library is empty."
					/>
				</Field>
			{/if}

			{#if brief.avoid !== null}
				<Field label="Must avoid" hint="Pick from your library">
					<ChipSelect
						bind:selected={field.avoid.value}
						options={libraryExercises}
						emptyLabel="Your library is empty."
					/>
				</Field>
			{/if}

			{#if brief.measurePreference !== null}
				<Field label="Set style">
					<SegmentedControl
						bind:value={field.measurePreference.value}
						segments={MEASURES}
						size="sm"
						class="w-full"
					/>
				</Field>
			{/if}

			{#if brief.notes !== null}
				<Field label="Anything else" for="brief-notes" class="sm:col-span-2">
					<TextInput
						id="brief-notes"
						bind:value={field.notes.value}
						placeholder="Keep the warm-up short, I hate burpees"
					/>
				</Field>
			{/if}
		</div>
	{/if}
</div>
