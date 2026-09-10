import { z } from 'zod';
import { idSchema, measureSchema, timestampsSchema } from './common.ts';

/**
 * An exercise is the smallest reusable unit of the library: a movement, drill
 * or effort. Deliberately sport-agnostic — a pull-up, a 400m sprint and a
 * free-kick drill are all the same shape.
 */

export const exerciseCategorySchema = z.enum([
	'strength',
	'cardio',
	'mobility',
	'skill',
	'endurance',
	'other'
]);
export type ExerciseCategory = z.infer<typeof exerciseCategorySchema>;

export const EXERCISE_CATEGORY_LABEL: Record<ExerciseCategory, string> = {
	strength: 'Strength',
	cardio: 'Cardio',
	mobility: 'Mobility',
	skill: 'Skill',
	endurance: 'Endurance',
	other: 'Other'
};

/** What the client sends to create or replace an exercise. */
export const exerciseInputSchema = z.object({
	name: z.string().trim().min(1, 'A name is required').max(80),
	/** What the movement is. */
	description: z.string().trim().max(2000).default(''),
	/** How to perform it — cues, form, safety. */
	instructions: z.string().trim().max(4000).default(''),
	category: exerciseCategorySchema.default('other'),
	tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
	/** Pre-filled when the exercise is dropped into a session. */
	defaultMeasure: measureSchema.nullable().default(null)
});
export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

/** Partial update — every field optional, same rules. */
export const exercisePatchSchema = exerciseInputSchema.partial();
export type ExercisePatch = z.infer<typeof exercisePatchSchema>;

export const exerciseSchema = exerciseInputSchema.extend({
	id: idSchema,
	...timestampsSchema.shape
});
export type Exercise = z.infer<typeof exerciseSchema>;

/** An exercise plus how the library is using it, for delete guards and sorting. */
export const exerciseWithUsageSchema = exerciseSchema.extend({
	sessionCount: z.number().int().min(0)
});
export type ExerciseWithUsage = z.infer<typeof exerciseWithUsageSchema>;
