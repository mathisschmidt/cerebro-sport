import type { IsoDate } from '$domain/models/common.ts';
import type {
	OccurrenceResolution,
	RoutineDetail,
	RoutineInput,
	RoutineOccurrence,
	RoutinePatch
} from '$domain/models/routine.ts';
import type { SessionSummary } from '$domain/models/session.ts';
import { buildOccurrences } from '$domain/services/occurrences.ts';
import { todayIso } from '$domain/services/date.ts';
import { routineRepository } from '../repositories/routine.repository.ts';
import { sessionRepository } from '../repositories/session.repository.ts';
import { notFound, validationFailed } from '../http/errors.ts';
import type { Routine } from '$domain/models/routine.ts';

/**
 * Routines and the schedule they generate.
 *
 * The calendar is always derived from the rules, then overlaid with recorded
 * completions. A recorded occurrence that the current rule no longer generates
 * — because the routine was paused or its rule edited — is still surfaced, so
 * past adherence never rewrites itself.
 */

function toDetail(routine: Routine, sessions: Map<string, SessionSummary>): RoutineDetail {
	const session = sessions.get(routine.sessionId);
	return {
		...routine,
		name: routine.name,
		sessionName: session?.name ?? 'Deleted session',
		estimatedDurationSec: session?.estimatedDurationSec ?? 0
	};
}

function loadSessions(userId: string, routines: Routine[]): Map<string, SessionSummary> {
	return sessionRepository.findSummariesByIds(userId, [
		...new Set(routines.map((r) => r.sessionId))
	]);
}

export const routineService = {
	list(userId: string): RoutineDetail[] {
		const routines = routineRepository.list(userId);
		const sessions = loadSessions(userId, routines);
		return routines.map((routine) => toDetail(routine, sessions));
	},

	get(userId: string, id: string): RoutineDetail {
		const routine = routineRepository.findById(userId, id);
		if (!routine) throw notFound('Routine not found');
		return toDetail(routine, loadSessions(userId, [routine]));
	},

	create(userId: string, input: RoutineInput): RoutineDetail {
		assertSessionExists(userId, input.sessionId);
		assertWindow(input.startDate, input.endDate);
		const routine = routineRepository.create(userId, input);
		return toDetail(routine, loadSessions(userId, [routine]));
	},

	update(userId: string, id: string, patch: RoutinePatch): RoutineDetail {
		if (patch.sessionId) assertSessionExists(userId, patch.sessionId);
		const existing = routineRepository.findById(userId, id);
		if (!existing) throw notFound('Routine not found');
		assertWindow(patch.startDate ?? existing.startDate, patch.endDate !== undefined ? patch.endDate : existing.endDate);

		const routine = routineRepository.update(userId, id, patch);
		if (!routine) throw notFound('Routine not found');
		return toDetail(routine, loadSessions(userId, [routine]));
	},

	remove(userId: string, id: string): void {
		if (!routineRepository.remove(userId, id)) throw notFound('Routine not found');
	},

	/**
	 * Every occurrence in `[from, to]`, ordered by date then time of day.
	 */
	occurrences(userId: string, from: IsoDate, to: IsoDate): RoutineOccurrence[] {
		const routines = routineRepository.list(userId);
		if (routines.length === 0) return [];
		return buildOccurrences(
			{
				routines,
				sessions: loadSessions(userId, routines),
				records: routineRepository.findOccurrences(userId, from, to)
			},
			from,
			to
		);
	},

	/** The agenda for one day. */
	day(userId: string, date: IsoDate = todayIso()): RoutineOccurrence[] {
		return this.occurrences(userId, date, date);
	},

	resolve(userId: string, resolution: OccurrenceResolution): RoutineOccurrence {
		const routine = routineRepository.findById(userId, resolution.routineId);
		if (!routine) throw notFound('Routine not found');
		routineRepository.resolveOccurrence(resolution);
		const day = this.day(userId, resolution.date).find((o) => o.routineId === resolution.routineId);
		if (!day) throw notFound('Occurrence not found');
		return day;
	}
};

function assertSessionExists(userId: string, sessionId: string): void {
	if (!sessionRepository.findSummary(userId, sessionId)) {
		throw validationFailed('That session no longer exists', { sessionId: 'Unknown session' });
	}
}

function assertWindow(startDate: IsoDate, endDate: IsoDate | null): void {
	if (endDate && endDate < startDate) {
		throw validationFailed('The end date must come after the start date', {
			endDate: 'Must be after the start date'
		});
	}
}
