import type { OfflineSnapshot } from '$domain/models/offline.ts';
import type { SessionPlan } from '$domain/models/plan.ts';
import { addDays, todayIso } from '$domain/services/date.ts';
import { buildPlan } from '$domain/services/session-plan.ts';
import { routineRepository } from '../repositories/routine.repository.ts';
import { sessionRepository } from '../repositories/session.repository.ts';

/** How far around today recorded occurrences are shipped to the phone. */
const RECORDS_BEFORE_DAYS = 7;
const RECORDS_AFTER_DAYS = 30;

/** The most sessions a snapshot carries — the same ceiling as any list. */
const MAX_SESSIONS = 200;

export const offlineService = {
	/**
	 * What the phone needs to train offline. Plans are built by the same
	 * `buildPlan` the runner always used, so a run started offline is exactly
	 * the run it would have been online.
	 */
	snapshot(userId: string): OfflineSnapshot {
		const today = todayIso();
		const recordsFrom = addDays(today, -RECORDS_BEFORE_DAYS);
		const recordsTo = addDays(today, RECORDS_AFTER_DAYS);

		const sessions = sessionRepository.list(userId, { limit: MAX_SESSIONS, offset: 0 }).items;
		const plans: Record<string, SessionPlan> = {};
		for (const summary of sessions) {
			const detail = sessionRepository.findDetail(userId, summary.id);
			if (detail) plans[summary.id] = buildPlan(detail);
		}

		return {
			userId,
			generatedAt: new Date().toISOString(),
			sessions,
			plans,
			routines: routineRepository.list(userId),
			records: [...routineRepository.findOccurrences(userId, recordsFrom, recordsTo).values()],
			recordsFrom,
			recordsTo
		};
	}
};
