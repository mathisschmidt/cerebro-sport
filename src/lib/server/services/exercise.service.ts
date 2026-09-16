import type { Page, PageQuery } from '$domain/models/common.ts';
import type {
	Exercise,
	ExerciseInput,
	ExercisePatch,
	ExerciseWithUsage
} from '$domain/models/exercise.ts';
import { normalizeCategory } from '$domain/models/exercise.ts';
import { exerciseRepository } from '../repositories/exercise.repository.ts';
import { conflict, notFound } from '../http/errors.ts';

/**
 * Business rules for the exercise library.
 *
 * Every method takes the owning `userId` first: a library belongs to one
 * athlete, and there is no call path that reads across accounts.
 */
export const exerciseService = {
	list(userId: string, query: PageQuery): Page<ExerciseWithUsage> {
		return exerciseRepository.list(userId, query);
	},

	get(userId: string, id: string): Exercise {
		const exercise = exerciseRepository.findById(userId, id);
		if (!exercise) throw notFound('Exercise not found');
		return exercise;
	},

	create(userId: string, input: ExerciseInput): Exercise {
		// Names are how exercises are picked in the session editor, so they must
		// stay distinguishable.
		if (exerciseRepository.findByName(userId, input.name)) {
			throw conflict(`An exercise named "${input.name}" already exists`, { name: 'Already used' });
		}
		return exerciseRepository.create(userId, { ...input, ...normalizeCategory(input) });
	},

	update(userId: string, id: string, patch: ExercisePatch): Exercise {
		if (patch.name && exerciseRepository.findByName(userId, patch.name, id)) {
			throw conflict(`An exercise named "${patch.name}" already exists`, { name: 'Already used' });
		}
		const current = exerciseRepository.findById(userId, id);
		if (!current) throw notFound('Exercise not found');
		// A patch may move the category, name a custom one, or both, so the pair is
		// normalised against the merged values rather than against the patch alone.
		const category = normalizeCategory({
			category: patch.category ?? current.category,
			customCategory:
				patch.customCategory !== undefined ? patch.customCategory : current.customCategory
		});
		const updated = exerciseRepository.update(userId, id, { ...patch, ...category });
		if (!updated) throw notFound('Exercise not found');
		return updated;
	},

	remove(userId: string, id: string): void {
		const usage = exerciseRepository.countUsage(userId, id);
		if (usage > 0) {
			throw conflict(
				`This exercise is used by ${usage} session${usage > 1 ? 's' : ''}. Remove it from them first.`
			);
		}
		if (!exerciseRepository.remove(userId, id)) throw notFound('Exercise not found');
	}
};
