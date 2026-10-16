import type { IsoDate, IsoDateTime } from './common.ts';
import type { SessionPlan } from './plan.ts';
import type { OccurrenceRecord, Routine } from './routine.ts';
import type { SessionSummary } from './session.ts';

/**
 * Everything the phone keeps to train without a connection: what can be run
 * and when it is due. A read model — the server assembles it, the phone stores
 * it whole and replaces it whole, so it is never merged or edited locally.
 */
export interface OfflineSnapshot {
	/** The account it belongs to; a snapshot is never shown to anyone else. */
	userId: string;
	generatedAt: IsoDateTime;
	/** Every session, as the "Free session" picker lists them. */
	sessions: SessionSummary[];
	/** The runnable plan of each session, by session id. */
	plans: Record<string, SessionPlan>;
	/** Schedule rules, so today's plan can be rebuilt on any day offline. */
	routines: Routine[];
	/** Recorded completions and skips around today, for the same rebuild. */
	records: OccurrenceRecord[];
	/** The window `records` covers. */
	recordsFrom: IsoDate;
	recordsTo: IsoDate;
}
