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

/**
 * A category of the athlete's own making, used when none of the built-ins fit.
 * It lives on the exercise rather than in a table of its own: the set of custom
 * categories is simply the distinct values across the library, so there is
 * nothing to keep in step and nothing left behind when the last exercise using
 * one is edited away.
 */
export const customCategorySchema = z.string().trim().max(40);

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
	/**
	 * Only meaningful alongside `category: 'other'`, and only when it is not
	 * blank — `normalizeCategory` drops it otherwise, which is what makes an
	 * unnamed "other" stay plain "other".
	 */
	customCategory: customCategorySchema.nullable().default(null),
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

/** The category pair as it is allowed to be stored. */
type CategoryFields = Pick<ExerciseInput, 'category' | 'customCategory'>;

/**
 * A custom name counts only when the category is `other` and something was
 * actually typed. Everything that writes an exercise goes through this, so the
 * two columns can never disagree.
 */
export function normalizeCategory(fields: CategoryFields): CategoryFields {
	const custom = fields.customCategory?.trim();
	return {
		category: fields.category,
		customCategory: fields.category === 'other' && custom ? custom : null
	};
}

/** What to show for an exercise's category — its own name wins over "Other". */
export function exerciseCategoryLabel(fields: CategoryFields): string {
	return fields.customCategory?.trim() || EXERCISE_CATEGORY_LABEL[fields.category];
}

/** Every custom category in a library, de-duplicated case-insensitively. */
export function customCategoriesOf(exercises: readonly CategoryFields[]): string[] {
	const seen = new Map<string, string>();
	for (const exercise of exercises) {
		const custom = exercise.customCategory?.trim();
		if (custom && !seen.has(custom.toLowerCase())) seen.set(custom.toLowerCase(), custom);
	}
	return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** An exercise plus how the library is using it, for delete guards and sorting. */
export const exerciseWithUsageSchema = exerciseSchema.extend({
	sessionCount: z.number().int().min(0)
});
export type ExerciseWithUsage = z.infer<typeof exerciseWithUsageSchema>;
