<script lang="ts">
	import type { WorkoutOutcome } from '$domain/models/workout.ts';
	import { WORKOUT_OUTCOME_LABEL } from '$domain/models/workout.ts';
	import Badge, { type BadgeTone } from '$components/ui/Badge.svelte';

	/**
	 * How a run went, as a coloured badge. The colour is never alone — the label
	 * always says it too. Green up to 30% missed, yellow past it, red past half.
	 */
	interface Props {
		outcome: WorkoutOutcome;
	}

	let { outcome }: Props = $props();

	const TONES: Record<WorkoutOutcome, BadgeTone> = {
		complete: 'success',
		unfinished: 'success',
		skipped_some: 'warning',
		ended_early: 'danger'
	};
</script>

<Badge tone={TONES[outcome]}>{WORKOUT_OUTCOME_LABEL[outcome]}</Badge>
