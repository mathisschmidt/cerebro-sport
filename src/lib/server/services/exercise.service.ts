import type { Page, PageQuery } from '$domain/models/common.ts';
import type {
	Exercise,
	ExerciseInput,
	ExercisePatch,
	ExerciseWithUsage
} from '$domain/models/exercise.ts';
import { exerciseRepository } from '../repositories/exercise.repository.ts';
import { conflict, notFound } from '../http/errors.ts';

/** Business rules for the exercise library. */
export const exerciseService = {
	list(query: PageQuery): Page<ExerciseWithUsage> {
		return exerciseRepository.list(query);
	},

	get(id: string): Exercise {
		const exercise = exerciseRepository.findById(id);
		if (!exercise) throw notFound('Exercise not found');
		return exercise;
	},

	create(input: ExerciseInput): Exercise {
		// Names are how exercises are picked in the session editor, so they must
		// stay distinguishable.
		if (exerciseRepository.findByName(input.name)) {
			throw conflict(`An exercise named "${input.name}" already exists`, { name: 'Already used' });
		}
		return exerciseRepository.create(input);
	},

	update(id: string, patch: ExercisePatch): Exercise {
		if (patch.name && exerciseRepository.findByName(patch.name, id)) {
			throw conflict(`An exercise named "${patch.name}" already exists`, { name: 'Already used' });
		}
		const updated = exerciseRepository.update(id, patch);
		if (!updated) throw notFound('Exercise not found');
		return updated;
	},

	remove(id: string): void {
		const usage = exerciseRepository.countUsage(id);
		if (usage > 0) {
			throw conflict(
				`This exercise is used by ${usage} session${usage > 1 ? 's' : ''}. Remove it from them first.`
			);
		}
		if (!exerciseRepository.remove(id)) throw notFound('Exercise not found');
	}
};
