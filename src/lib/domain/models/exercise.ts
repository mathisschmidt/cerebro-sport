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

/** The tag half of an exercise, for helpers that only look at tags. */
type TagFields = Pick<ExerciseInput, 'tags'>;

/**
 * A stable key for the category facet. A built-in is keyed by its own value; a
 * category of the athlete's own making is keyed by its name folded to lower
 * case, so "Recovery" and "recovery" are one filter rather than two.
 */
export function categoryKeyOf(fields: CategoryFields): string {
	const custom = fields.customCategory?.trim();
	return custom ? `custom:${custom.toLowerCase()}` : fields.category;
}

/** One choice in the category facet: what to match on, and what to show. */
export interface CategoryOption {
	key: string;
	label: string;
}

/**
 * The categories a library actually uses — built-ins in their declared order,
 * then custom ones alphabetically. Only what is in use, so no chip can filter
 * the list down to nothing.
 */
export function categoryOptionsOf(exercises: readonly CategoryFields[]): CategoryOption[] {
	const used = new Set(exercises.map(categoryKeyOf));
	return [
		...exerciseCategorySchema.options
			.filter((category) => used.has(category))
			.map((category) => ({ key: category, label: EXERCISE_CATEGORY_LABEL[category] })),
		...customCategoriesOf(exercises).map((name) => ({
			key: `custom:${name.toLowerCase()}`,
			label: name
		}))
	];
}

/**
 * Every tag in a library, de-duplicated case-insensitively and sorted. Like
 * custom categories, the set of tags is simply the distinct values across the
 * library — there is no table of them to keep in step.
 */
export function tagsOf(exercises: readonly TagFields[]): string[] {
	const seen = new Map<string, string>();
	for (const exercise of exercises) {
		for (const raw of exercise.tags) {
			const tag = raw.trim();
			const key = tag.toLowerCase();
			if (tag && !seen.has(key)) seen.set(key, tag);
		}
	}
	return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * How the library narrows its exercise list. Within a facet the selections are
 * alternatives — two categories means either of them; across facets they
 * combine — a category *and* a tag *and* the search term.
 */
export interface ExerciseFilter {
	/** Free text, matched against name, description, category and tags. */
	search: string;
	/** Category keys, as `categoryKeyOf` produces them. */
	categories: readonly string[];
	/** Tag names, matched case-insensitively. */
	tags: readonly string[];
}

export const EMPTY_EXERCISE_FILTER: ExerciseFilter = { search: '', categories: [], tags: [] };

/** Is anything actually being filtered? Drives "no results" wording and the badge. */
export function isExerciseFilterActive(filter: ExerciseFilter): boolean {
	return (
		filter.search.trim().length > 0 || filter.categories.length > 0 || filter.tags.length > 0
	);
}

/**
 * The filter as chosen, minus any selection whose option has since disappeared.
 * Editing away the last exercise with a tag drops its chip; ignoring the
 * selection keeps the list from going permanently empty with nothing on screen
 * to explain it.
 */
export function effectiveExerciseFilter(
	filter: ExerciseFilter,
	categoryOptions: readonly CategoryOption[],
	tagOptions: readonly string[]
): ExerciseFilter {
	return {
		search: filter.search,
		categories: filter.categories.filter((key) =>
			categoryOptions.some((option) => option.key === key)
		),
		tags: filter.tags.filter((tag) => tagOptions.includes(tag))
	};
}

/** Enough of an exercise to filter it — so a summary or a full row both qualify. */
type FilterableExercise = CategoryFields & TagFields & Pick<ExerciseInput, 'name' | 'description'>;

/** Does one exercise survive the filter? Pure, so every caller agrees on the rules. */
export function matchesExerciseFilter(
	exercise: FilterableExercise,
	filter: ExerciseFilter
): boolean {
	const term = filter.search.trim().toLowerCase();
	if (term) {
		const haystack = [
			exercise.name,
			exercise.description,
			exerciseCategoryLabel(exercise),
			...exercise.tags
		]
			.join(' ')
			.toLowerCase();
		if (!haystack.includes(term)) return false;
	}

	if (filter.categories.length > 0 && !filter.categories.includes(categoryKeyOf(exercise))) {
		return false;
	}

	if (filter.tags.length > 0) {
		const own = new Set(exercise.tags.map((tag) => tag.trim().toLowerCase()));
		if (!filter.tags.some((tag) => own.has(tag.trim().toLowerCase()))) return false;
	}

	return true;
}
