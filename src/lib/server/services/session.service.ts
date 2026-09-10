import type { Page, PageQuery } from '$domain/models/common.ts';
import type { SessionDetail, SessionInput, SessionSummary } from '$domain/models/session.ts';
import type { SessionPlan } from '$domain/models/plan.ts';
import { buildPlan } from '$domain/services/session-plan.ts';
import { exerciseRepository } from '../repositories/exercise.repository.ts';
import { routineRepository } from '../repositories/routine.repository.ts';
import { sessionRepository } from '../repositories/session.repository.ts';
import { conflict, notFound, validationFailed } from '../http/errors.ts';

/** Every exercise referenced by the session must exist before it is written. */
function assertExercisesExist(userId: string, input: SessionInput): void {
	const ids = [...new Set(input.blocks.flatMap((block) => block.items.map((i) => i.exerciseId)))];
	const found = exerciseRepository.findManyByIds(userId, ids);
	const missing = ids.filter((id) => !found.has(id));
	if (missing.length > 0) {
		throw validationFailed('Some exercises no longer exist', { exerciseIds: missing.join(', ') });
	}
}

export const sessionService = {
	list(userId: string, query: PageQuery): Page<SessionSummary> {
		return sessionRepository.list(userId, query);
	},

	get(userId: string, id: string): SessionDetail {
		const session = sessionRepository.findDetail(userId, id);
		if (!session) throw notFound('Session not found');
		return session;
	},

	/** The runnable, flattened form — also what gets snapshotted onto a workout. */
	plan(userId: string, id: string): SessionPlan {
		return buildPlan(this.get(userId, id));
	},

	create(userId: string, input: SessionInput): SessionDetail {
		assertExercisesExist(userId, input);
		return sessionRepository.create(userId, input);
	},

	update(userId: string, id: string, input: SessionInput): SessionDetail {
		assertExercisesExist(userId, input);
		const updated = sessionRepository.replace(userId, id, input);
		if (!updated) throw notFound('Session not found');
		return updated;
	},

	remove(userId: string, id: string): void {
		// Cascading would silently delete the user's schedule; make it explicit.
		const routines = routineRepository.findBySessionId(userId, id);
		if (routines.length > 0) {
			throw conflict(
				`This session is scheduled by ${routines.length} routine${routines.length > 1 ? 's' : ''}. Delete ${routines.length > 1 ? 'them' : 'it'} first.`
			);
		}
		if (!sessionRepository.remove(userId, id)) throw notFound('Session not found');
	}
};
