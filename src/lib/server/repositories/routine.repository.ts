import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { IsoDate } from '$domain/models/common.ts';
import type {
	OccurrenceRecord,
	OccurrenceResolution,
	Routine,
	RoutineInput,
	RoutinePatch
} from '$domain/models/routine.ts';
import { db, schema } from '../db/client.ts';
import { fromRecurrence, toRoutine } from '../db/mappers.ts';
import { newId } from '../db/ids.ts';
import { ownedBy } from './scope.ts';

const { routines, routineOccurrences } = schema;

function toRowValues(input: RoutineInput) {
	return {
		name: input.name,
		sessionId: input.sessionId,
		...fromRecurrence(input.recurrence),
		startDate: input.startDate,
		endDate: input.endDate,
		timeOfDay: input.timeOfDay,
		active: input.active
	};
}

export const routineRepository = {
	list(userId: string, options: { activeOnly?: boolean } = {}): Routine[] {
		const rows = db
			.select()
			.from(routines)
			.where(
				ownedBy(routines.userId, userId, options.activeOnly ? eq(routines.active, true) : undefined)
			)
			.orderBy(asc(routines.timeOfDay), asc(routines.name))
			.all();
		return rows.map(toRoutine);
	},

	findById(userId: string, id: string): Routine | null {
		const row = db
			.select()
			.from(routines)
			.where(ownedBy(routines.userId, userId, eq(routines.id, id)))
			.get();
		return row ? toRoutine(row) : null;
	},

	findBySessionId(userId: string, sessionId: string): Routine[] {
		return db
			.select()
			.from(routines)
			.where(ownedBy(routines.userId, userId, eq(routines.sessionId, sessionId)))
			.all()
			.map(toRoutine);
	},

	create(userId: string, input: RoutineInput): Routine {
		const now = new Date().toISOString();
		const row = db
			.insert(routines)
			.values({ id: newId(), userId, ...toRowValues(input), createdAt: now, updatedAt: now })
			.returning()
			.get();
		return toRoutine(row);
	},

	update(userId: string, id: string, patch: RoutinePatch): Routine | null {
		const current = this.findById(userId, id);
		if (!current) return null;
		const merged: RoutineInput = {
			name: patch.name ?? current.name,
			sessionId: patch.sessionId ?? current.sessionId,
			recurrence: patch.recurrence ?? current.recurrence,
			startDate: patch.startDate ?? current.startDate,
			endDate: patch.endDate !== undefined ? patch.endDate : current.endDate,
			timeOfDay: patch.timeOfDay !== undefined ? patch.timeOfDay : current.timeOfDay,
			active: patch.active ?? current.active
		};
		const row = db
			.update(routines)
			.set({ ...toRowValues(merged), updatedAt: new Date().toISOString() })
			.where(ownedBy(routines.userId, userId, eq(routines.id, id)))
			.returning()
			.get();
		return row ? toRoutine(row) : null;
	},

	remove(userId: string, id: string): boolean {
		if (!this.findById(userId, id)) return false;
		return db.transaction((tx) => {
			tx.delete(routineOccurrences).where(eq(routineOccurrences.routineId, id)).run();
			return tx.delete(routines).where(eq(routines.id, id)).run().changes > 0;
		});
	},

	/** Recorded deviations in a date range, keyed `routineId|date`. */
	findOccurrences(userId: string, from: IsoDate, to: IsoDate): Map<string, OccurrenceRecord> {
		const rows = db
			.select({ occurrence: routineOccurrences })
			.from(routineOccurrences)
			.innerJoin(routines, eq(routineOccurrences.routineId, routines.id))
			.where(
				ownedBy(
					routines.userId,
					userId,
					and(gte(routineOccurrences.date, from), lte(routineOccurrences.date, to))
				)
			)
			.all()
			.map((joined) => joined.occurrence);

		return new Map(
			rows.map((row) => [
				`${row.routineId}|${row.date}`,
				{
					routineId: row.routineId,
					date: row.date,
					status: row.status as 'completed' | 'skipped',
					workoutId: row.workoutId,
					resolvedAt: row.resolvedAt
				}
			])
		);
	},

	findOccurrencesForRoutines(userId: string, routineIds: string[]): OccurrenceRecord[] {
		if (routineIds.length === 0) return [];
		return db
			.select({ occurrence: routineOccurrences })
			.from(routineOccurrences)
			.innerJoin(routines, eq(routineOccurrences.routineId, routines.id))
			.where(ownedBy(routines.userId, userId, inArray(routineOccurrences.routineId, routineIds)))
			.all()
			.map(({ occurrence: row }) => ({
				routineId: row.routineId,
				date: row.date,
				status: row.status as 'completed' | 'skipped',
				workoutId: row.workoutId,
				resolvedAt: row.resolvedAt
			}));
	},

	/**
	 * Unlinks occurrences from workouts that no longer exist. The tick itself
	 * stays: the routine was honoured that day whether or not its run is kept.
	 * Callers pass ids of workouts they have already established are the user's.
	 */
	detachWorkouts(workoutIds: string[]): void {
		if (workoutIds.length === 0) return;
		db.update(routineOccurrences)
			.set({ workoutId: null })
			.where(inArray(routineOccurrences.workoutId, workoutIds))
			.run();
	},

	/** Upserts a deviation; `pending` clears the row so absence stays the default. */
	/** Callers must have already established that the routine belongs to the user. */
	resolveOccurrence(resolution: OccurrenceResolution): void {
		if (resolution.status === 'pending') {
			db.delete(routineOccurrences)
				.where(
					and(
						eq(routineOccurrences.routineId, resolution.routineId),
						eq(routineOccurrences.date, resolution.date)
					)
				)
				.run();
			return;
		}

		db.insert(routineOccurrences)
			.values({
				id: newId(),
				routineId: resolution.routineId,
				date: resolution.date,
				status: resolution.status,
				workoutId: resolution.workoutId,
				resolvedAt: new Date().toISOString()
			})
			.onConflictDoUpdate({
				target: [routineOccurrences.routineId, routineOccurrences.date],
				set: {
					status: resolution.status,
					workoutId: resolution.workoutId,
					resolvedAt: sql`excluded.resolved_at`
				}
			})
			.run();
	}
};
