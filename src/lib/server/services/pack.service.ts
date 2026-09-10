import type { ImportOptions, ImportResult, Pack } from '$domain/models/pack.ts';
import type { PackPlan } from '$domain/services/pack-resolve.ts';
import { packKey, resolvePack, toSessionInput } from '$domain/services/pack-resolve.ts';
import { todayIso } from '$domain/services/date.ts';
import { exerciseRepository } from '../repositories/exercise.repository.ts';
import { sessionRepository } from '../repositories/session.repository.ts';
import { validationFailed } from '../http/errors.ts';
import { exerciseService } from './exercise.service.ts';
import { routineService } from './routine.service.ts';
import { sessionService } from './session.service.ts';

/**
 * Importing a training pack.
 *
 * The resolver is the shared, pure one the Coach page previews with — this
 * service just re-runs it against live data, then walks the result through the
 * ordinary create paths. Nothing here bypasses `exerciseService`,
 * `sessionService` or `routineService`, so an imported session is validated by
 * exactly the same rules as one built by hand in the editor.
 */

function library() {
	return {
		existingExercises: exerciseRepository
			.list({ limit: 500, offset: 0 })
			.items.map((exercise) => ({ id: exercise.id, name: exercise.name })),
		existingSessions: sessionRepository.listAllIdsAndNames()
	};
}

export const packService = {
	/** What importing this pack would do, resolved against the current library. */
	plan(pack: Pack, options?: Partial<ImportOptions>): PackPlan {
		return resolvePack(pack, { ...library(), today: todayIso(), options });
	},

	apply(pack: Pack, options: ImportOptions): ImportResult {
		const plan = this.plan(pack, options);

		if (!plan.importable) {
			throw validationFailed(
				'This pack cannot be imported yet',
				Object.fromEntries(
					plan.issues
						.filter((issue) => issue.level === 'error')
						.map((issue) => [issue.path, issue.message])
				)
			);
		}

		const result: ImportResult = {
			exercisesCreated: 0,
			exercisesReused: 0,
			sessionsCreated: [],
			routinesCreated: 0,
			skipped: [],
			renamed: []
		};

		// 1. Exercises first — sessions cannot be written until their ids exist.
		const exerciseIdByName = new Map<string, string>();
		for (const entry of plan.exercises) {
			if (entry.existingId) {
				exerciseIdByName.set(packKey(entry.name), entry.existingId);
				result.exercisesReused += 1;
				continue;
			}

			try {
				const created = exerciseService.create(entry.input);
				exerciseIdByName.set(packKey(created.name), created.id);
				result.exercisesCreated += 1;
			} catch (error) {
				// Lost a race with another tab, or a name that differs only by case:
				// reuse whatever is actually there rather than failing the import.
				const existing = exerciseRepository.findByName(entry.input.name);
				if (!existing) throw error;
				exerciseIdByName.set(packKey(existing.name), existing.id);
				result.exercisesReused += 1;
			}
		}

		// 2. Sessions.
		const sessionIdByName = new Map<string, string>();
		for (const entry of plan.sessions) {
			const created = sessionService.create(toSessionInput(entry, exerciseIdByName));
			sessionIdByName.set(packKey(created.name), created.id);
			result.sessionsCreated.push(created.name);
			if (entry.renamed) result.renamed.push({ from: entry.originalName, to: entry.name });
		}

		// 3. Routines, pointing at whichever session they named.
		const existingSessions = new Map(
			sessionRepository.listAllIdsAndNames().map((session) => [packKey(session.name), session.id])
		);

		for (const entry of plan.routines) {
			const sessionId =
				sessionIdByName.get(packKey(entry.sessionName)) ??
				existingSessions.get(packKey(entry.sessionName));

			if (!sessionId) {
				result.skipped.push(`Routine "${entry.name}" — no session called "${entry.sessionName}"`);
				continue;
			}

			routineService.create({
				name: entry.name,
				sessionId,
				recurrence: entry.source.recurrence,
				startDate: entry.startDate,
				endDate: entry.endDate,
				timeOfDay: entry.timeOfDay,
				active: true
			});
			result.routinesCreated += 1;
		}

		return result;
	}
};
