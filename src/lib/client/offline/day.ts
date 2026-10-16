import type { IsoDate } from '$domain/models/common.ts';
import type { OfflineSnapshot } from '$domain/models/offline.ts';
import type { RoutineOccurrence } from '$domain/models/routine.ts';
import { buildOccurrences, occurrenceKey } from '$domain/services/occurrences.ts';
import type { LocalRun } from './runs.svelte.ts';

/**
 * The day view without a server: the same `buildOccurrences` the server uses,
 * run on the phone's stored rules — so a stored home page from yesterday still
 * shows today's plan, not yesterday's.
 */
export function occurrencesFromSnapshot(
	snapshot: OfflineSnapshot,
	from: IsoDate,
	to: IsoDate
): RoutineOccurrence[] {
	return buildOccurrences(
		{
			routines: snapshot.routines,
			sessions: new Map(
				snapshot.sessions.map((session) => [
					session.id,
					{ name: session.name, estimatedDurationSec: session.estimatedDurationSec }
				])
			),
			records: new Map(
				snapshot.records.map((record) => [occurrenceKey(record.routineId, record.date), record])
			)
		},
		from,
		to
	);
}

/**
 * A routine run to the end on this phone is done, even before the server has
 * heard — the same tick the server will give it once the run syncs.
 */
export function withLocalRuns(
	occurrences: RoutineOccurrence[],
	waiting: LocalRun[]
): RoutineOccurrence[] {
	const done = new Map(
		waiting
			.filter((run) => run.status === 'completed' && run.routineId && run.occurrenceDate)
			.map((run) => [occurrenceKey(run.routineId as string, run.occurrenceDate as string), run])
	);
	return occurrences.map((occurrence) => {
		const run = done.get(occurrenceKey(occurrence.routineId, occurrence.date));
		if (!run || occurrence.status !== 'pending') return occurrence;
		return { ...occurrence, status: 'completed', workoutId: run.id, resolvedAt: run.completedAt };
	});
}
