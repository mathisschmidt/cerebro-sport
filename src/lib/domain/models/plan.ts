import { z } from 'zod';
import { idSchema, measureSchema } from './common.ts';

/**
 * The plan is the flattened, runnable form of a session: blocks and rounds
 * expanded into a linear list of steps, with rest turned into real steps of its
 * own. The runner walks it; a snapshot of it is frozen onto every workout so a
 * later edit to the session never rewrites history.
 */

export const planStepKindSchema = z.enum(['exercise', 'rest']);
export type PlanStepKind = z.infer<typeof planStepKindSchema>;

/** Which boundary a rest step sits on — drives its label and colour. */
export const restKindSchema = z.enum(['item', 'round', 'block']);
export type RestKind = z.infer<typeof restKindSchema>;

export const planStepSchema = z.object({
	index: z.number().int().min(0),
	/**
	 * Stable identity of this step across every execution of the session.
	 * Comparing the same `key` over time is what makes "am I getting faster?"
	 * answerable per step rather than only per session.
	 */
	key: z.string().min(1),
	kind: planStepKindSchema,

	blockId: idSchema,
	blockIndex: z.number().int().min(0),
	blockLabel: z.string(),
	roundIndex: z.number().int().min(1),
	roundCount: z.number().int().min(1),

	itemId: idSchema.nullable(),
	itemIndex: z.number().int().min(0).nullable(),

	exerciseId: idSchema.nullable(),
	exerciseName: z.string(),
	exerciseInstructions: z.string(),
	measure: measureSchema.nullable(),
	targetLoad: z.string(),
	notes: z.string(),

	restSec: z.number().int().min(0).nullable(),
	restKind: restKindSchema.nullable(),

	/** Planned length, used for the progress bar and the session estimate. */
	estimatedSec: z.number().int().min(0)
});
export type PlanStep = z.infer<typeof planStepSchema>;

export const sessionPlanSchema = z.object({
	sessionId: idSchema,
	sessionName: z.string(),
	sessionDescription: z.string(),
	steps: z.array(planStepSchema),
	estimatedDurationSec: z.number().int().min(0)
});
export type SessionPlan = z.infer<typeof sessionPlanSchema>;

export function planStepLabel(step: PlanStep): string {
	if (step.kind === 'rest') {
		switch (step.restKind) {
			case 'round':
				return 'Rest before next round';
			case 'block':
				return 'Rest before next block';
			default:
				return 'Rest';
		}
	}
	return step.exerciseName;
}
