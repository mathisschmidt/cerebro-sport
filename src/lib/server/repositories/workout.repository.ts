import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { SessionPlan } from '$domain/models/plan.ts';
import type {
	Workout,
	WorkoutDetail,
	WorkoutQuery,
	WorkoutStepLog,
	WorkoutStepLogInput
} from '$domain/models/workout.ts';
import { db, schema } from '../db/client.ts';
import { fromMeasure, toWorkout, toWorkoutStep } from '../db/mappers.ts';
import { newId } from '../db/ids.ts';
import { ownedBy } from './scope.ts';

const { workouts, workoutSteps } = schema;

function attachSteps(rows: Workout[]): WorkoutDetail[] {
	if (rows.length === 0) return [];
	const stepRows = db
		.select()
		.from(workoutSteps)
		.where(inArray(workoutSteps.workoutId, rows.map((row) => row.id)))
		.orderBy(asc(workoutSteps.workoutId), asc(workoutSteps.stepIndex))
		.all();

	const byWorkout = new Map<string, WorkoutStepLog[]>();
	for (const row of stepRows) {
		const step = toWorkoutStep(row);
		const list = byWorkout.get(row.workoutId);
		if (list) list.push(step);
		else byWorkout.set(row.workoutId, [step]);
	}

	return rows.map((workout) => ({ ...workout, steps: byWorkout.get(workout.id) ?? [] }));
}

export const workoutRepository = {
	create(args: {
		userId: string;
		sessionId: string;
		sessionName: string;
		routineId: string | null;
		occurrenceDate: string | null;
		plan: SessionPlan;
	}): Workout {
		const now = new Date().toISOString();
		const row = db
			.insert(workouts)
			.values({
				id: newId(),
				userId: args.userId,
				sessionId: args.sessionId,
				sessionName: args.sessionName,
				routineId: args.routineId,
				occurrenceDate: args.occurrenceDate,
				status: 'in_progress',
				startedAt: now,
				completedAt: null,
				plannedStepCount: args.plan.steps.length,
				plan: JSON.stringify(args.plan),
				createdAt: now,
				updatedAt: now
			})
			.returning()
			.get();
		return toWorkout(row);
	},

	findById(userId: string, id: string): Workout | null {
		const row = db
			.select()
			.from(workouts)
			.where(ownedBy(workouts.userId, userId, eq(workouts.id, id)))
			.get();
		return row ? toWorkout(row) : null;
	},

	findDetail(userId: string, id: string): WorkoutDetail | null {
		const workout = this.findById(userId, id);
		return workout ? (attachSteps([workout])[0] ?? null) : null;
	},

	/** Most recent unfinished workout, used to offer a resume. */
	findActive(userId: string): Workout | null {
		const row = db
			.select()
			.from(workouts)
			.where(ownedBy(workouts.userId, userId, eq(workouts.status, 'in_progress')))
			.orderBy(desc(workouts.startedAt))
			.get();
		return row ? toWorkout(row) : null;
	},

	list(userId: string, query: WorkoutQuery): Workout[] {
		const filters = [
			query.sessionId ? eq(workouts.sessionId, query.sessionId) : undefined,
			query.status ? eq(workouts.status, query.status) : undefined,
			query.from ? gte(workouts.startedAt, `${query.from}T00:00:00.000Z`) : undefined,
			query.to ? lte(workouts.startedAt, `${query.to}T23:59:59.999Z`) : undefined
		].filter((clause) => clause !== undefined);

		return db
			.select()
			.from(workouts)
			.where(ownedBy(workouts.userId, userId, ...filters))
			.orderBy(desc(workouts.startedAt))
			.limit(query.limit)
			.offset(query.offset)
			.all()
			.map(toWorkout);
	},

	listDetails(userId: string, query: WorkoutQuery): WorkoutDetail[] {
		return attachSteps(this.list(userId, query));
	},

	/**
	 * Records a finished step. Idempotent on (workout, stepIndex) so a retried
	 * request from a flaky phone connection cannot duplicate a log.
	 */
	/** Callers must have already established that the workout belongs to the user. */
	upsertStep(workoutId: string, input: WorkoutStepLogInput): WorkoutStepLog {
		const planned = fromMeasure(input.plannedMeasure);
		const values = {
			id: newId(),
			workoutId,
			stepIndex: input.stepIndex,
			stepKey: input.stepKey,
			kind: input.kind,
			blockId: input.blockId,
			blockIndex: input.blockIndex,
			itemId: input.itemId,
			itemIndex: input.itemIndex,
			roundIndex: input.roundIndex,
			exerciseId: input.exerciseId,
			exerciseName: input.exerciseName,
			plannedMeasureType: planned.type,
			plannedMeasureValue: planned.value,
			plannedRestSec: input.plannedRestSec,
			actualValue: input.actualValue,
			durationMs: input.durationMs,
			skipped: input.skipped,
			startedAt: input.startedAt,
			completedAt: input.completedAt
		};

		const row = db
			.insert(workoutSteps)
			.values(values)
			.onConflictDoUpdate({
				target: [workoutSteps.workoutId, workoutSteps.stepIndex],
				set: {
					stepKey: values.stepKey,
					kind: values.kind,
					actualValue: values.actualValue,
					durationMs: values.durationMs,
					skipped: values.skipped,
					startedAt: values.startedAt,
					completedAt: values.completedAt
				}
			})
			.returning()
			.get();

		this.refreshTotals(workoutId);
		return toWorkoutStep(row);
	},

	/**
	 * Recomputes the workout's rollups from its step logs, which are the only
	 * source of truth for how long a session took.
	 */
	refreshTotals(workoutId: string): void {
		const totals = db
			.select({
				completed: sql<number>`count(*)`,
				activeMs: sql<number>`coalesce(sum(case when ${workoutSteps.kind} = 'exercise' then ${workoutSteps.durationMs} else 0 end), 0)`,
				restMs: sql<number>`coalesce(sum(case when ${workoutSteps.kind} = 'rest' then ${workoutSteps.durationMs} else 0 end), 0)`
			})
			.from(workoutSteps)
			.where(and(eq(workoutSteps.workoutId, workoutId), eq(workoutSteps.skipped, false)))
			.get();

		const activeMs = totals?.activeMs ?? 0;
		const restMs = totals?.restMs ?? 0;

		db.update(workouts)
			.set({
				completedStepCount: totals?.completed ?? 0,
				activeMs,
				restMs,
				totalMs: activeMs + restMs,
				updatedAt: new Date().toISOString()
			})
			.where(eq(workouts.id, workoutId))
			.run();
	},

	finish(
		userId: string,
		id: string,
		args: { status: 'completed' | 'abandoned'; notes: string }
	): Workout | null {
		const current = this.findById(userId, id);
		if (!current) return null;

		// Totals come from the step logs, so a late `finish` call cannot inflate them.
		this.refreshTotals(id);

		const completedAt = new Date().toISOString();
		const row = db
			.update(workouts)
			.set({ status: args.status, notes: args.notes, completedAt, updatedAt: completedAt })
			.where(ownedBy(workouts.userId, userId, eq(workouts.id, id)))
			.returning()
			.get();
		return row ? toWorkout(row) : null;
	},

	remove(userId: string, id: string): boolean {
		if (!this.findById(userId, id)) return false;
		return db.transaction((tx) => {
			tx.delete(workoutSteps).where(eq(workoutSteps.workoutId, id)).run();
			return tx.delete(workouts).where(eq(workouts.id, id)).run().changes > 0;
		});
	},

	/** Distinct sessions that appear in history, including deleted ones. */
	listHistoricSessions(userId: string): Array<{ id: string; name: string }> {
		return db
			.selectDistinct({ id: workouts.sessionId, name: workouts.sessionName })
			.from(workouts)
			.where(ownedBy(workouts.userId, userId))
			.all();
	}
};
