import type { Measure } from '../models/common.ts';
import type { PlanStep, SessionPlan } from '../models/plan.ts';
import type { SessionDetail } from '../models/session.ts';

/**
 * Flattens a session into the linear list of steps the runner walks.
 *
 * This is the one place that knows how rounds unroll and where rest lands, so
 * the editor preview, the duration estimate, the runner and the metrics all
 * agree by construction.
 */

/** Rough pacing used only for estimates, never for measurement. */
export const SECONDS_PER_REP = 3;
export const SECONDS_PER_METRE = 0.3;

export function estimateMeasureSeconds(measure: Measure): number {
	switch (measure.type) {
		case 'time':
			return measure.value;
		case 'reps':
			return Math.round(measure.value * SECONDS_PER_REP);
		case 'distance':
			return Math.round(measure.value * SECONDS_PER_METRE);
	}
}

/** Minimal shape the flattening needs — satisfied by both inputs and entities. */
export interface PlannableItem {
	measure: Measure;
	restAfterSec: number;
}
export interface PlannableBlock {
	rounds: number;
	restBetweenRoundsSec: number;
	restAfterSec: number;
	items: PlannableItem[];
}

/**
 * Total planned seconds for a session, computed straight from its structure so
 * a list view never has to hydrate exercises just to show a duration.
 */
export function estimateSessionSeconds(blocks: PlannableBlock[]): number {
	let total = 0;
	blocks.forEach((block, blockIndex) => {
		const isLastBlock = blockIndex === blocks.length - 1;
		for (let round = 1; round <= block.rounds; round++) {
			const isLastRound = round === block.rounds;
			block.items.forEach((item, itemIndex) => {
				total += estimateMeasureSeconds(item.measure);
				const isLastItem = itemIndex === block.items.length - 1;
				if (!isLastItem) {
					total += item.restAfterSec;
				} else if (!isLastRound) {
					total += block.restBetweenRoundsSec > 0 ? block.restBetweenRoundsSec : item.restAfterSec;
				} else if (!isLastBlock) {
					total += block.restAfterSec;
				}
			});
		}
	});
	return total;
}

export function countExercises(blocks: PlannableBlock[]): number {
	return blocks.reduce((sum, block) => sum + block.items.length * block.rounds, 0);
}

export function buildPlan(session: SessionDetail): SessionPlan {
	const steps: PlanStep[] = [];

	const push = (step: Omit<PlanStep, 'index'>) => {
		steps.push({ ...step, index: steps.length });
	};

	session.blocks.forEach((block, blockIndex) => {
		const isLastBlock = blockIndex === session.blocks.length - 1;
		const blockLabel = block.label || `Block ${blockIndex + 1}`;

		for (let round = 1; round <= block.rounds; round++) {
			const isLastRound = round === block.rounds;

			block.items.forEach((item, itemIndex) => {
				const isLastItem = itemIndex === block.items.length - 1;

				push({
					key: `e:${block.id}:${item.id}:${round}`,
					kind: 'exercise',
					blockId: block.id,
					blockIndex,
					blockLabel,
					roundIndex: round,
					roundCount: block.rounds,
					itemId: item.id,
					itemIndex,
					exerciseId: item.exerciseId,
					exerciseName: item.exercise.name,
					exerciseInstructions: item.exercise.instructions,
					measure: item.measure,
					targetLoad: item.targetLoad,
					notes: item.notes,
					restSec: null,
					restKind: null,
					estimatedSec: estimateMeasureSeconds(item.measure)
				});

				const rest = resolveRest({ block, item, isLastItem, isLastRound, isLastBlock });
				if (rest) {
					push({
						key:
							rest.kind === 'item'
								? `r:${block.id}:${item.id}:${round}`
								: rest.kind === 'round'
									? `rr:${block.id}:${round}`
									: `rb:${block.id}`,
						kind: 'rest',
						blockId: block.id,
						blockIndex,
						blockLabel,
						roundIndex: round,
						roundCount: block.rounds,
						itemId: item.id,
						itemIndex,
						exerciseId: null,
						exerciseName: '',
						exerciseInstructions: '',
						measure: null,
						targetLoad: '',
						notes: '',
						restSec: rest.seconds,
						restKind: rest.kind,
						estimatedSec: rest.seconds
					});
				}
			});
		}
	});

	return {
		sessionId: session.id,
		sessionName: session.name,
		sessionDescription: session.description,
		steps,
		estimatedDurationSec: steps.reduce((sum, step) => sum + step.estimatedSec, 0)
	};
}

/**
 * Which rest, if any, follows an item. Rest belongs to the boundary it sits on:
 * between items, between rounds, or between blocks — and a trailing rest at the
 * very end of the session is dropped rather than made the athlete wait for it.
 */
function resolveRest(args: {
	block: { restBetweenRoundsSec: number; restAfterSec: number };
	item: { restAfterSec: number };
	isLastItem: boolean;
	isLastRound: boolean;
	isLastBlock: boolean;
}): { seconds: number; kind: 'item' | 'round' | 'block' } | null {
	const { block, item, isLastItem, isLastRound, isLastBlock } = args;

	if (!isLastItem) {
		return item.restAfterSec > 0 ? { seconds: item.restAfterSec, kind: 'item' } : null;
	}
	if (!isLastRound) {
		const seconds = block.restBetweenRoundsSec > 0 ? block.restBetweenRoundsSec : item.restAfterSec;
		return seconds > 0 ? { seconds, kind: 'round' } : null;
	}
	if (!isLastBlock && block.restAfterSec > 0) {
		return { seconds: block.restAfterSec, kind: 'block' };
	}
	return null;
}
