import { and, asc, countDistinct, eq, inArray, like, or, sql } from 'drizzle-orm';
import type { Page, PageQuery } from '$domain/models/common.ts';
import type { Exercise, ExerciseInput, ExercisePatch, ExerciseWithUsage } from '$domain/models/exercise.ts';
import { db, schema } from '../db/client.ts';
import { fromMeasure, toExercise } from '../db/mappers.ts';
import { newId } from '../db/ids.ts';

const { exercises, sessionBlocks, sessionItems } = schema;

/** How many distinct sessions reference each of the given exercises. */
function usageByExercise(exerciseIds: string[]): Map<string, number> {
	if (exerciseIds.length === 0) return new Map();
	const rows = db
		.select({
			exerciseId: sessionItems.exerciseId,
			sessions: countDistinct(sessionBlocks.sessionId)
		})
		.from(sessionItems)
		.innerJoin(sessionBlocks, eq(sessionItems.blockId, sessionBlocks.id))
		.where(inArray(sessionItems.exerciseId, exerciseIds))
		.groupBy(sessionItems.exerciseId)
		.all();
	return new Map(rows.map((row) => [row.exerciseId, row.sessions]));
}

function toRowValues(input: ExerciseInput) {
	const measure = fromMeasure(input.defaultMeasure);
	return {
		name: input.name,
		description: input.description,
		instructions: input.instructions,
		category: input.category,
		tags: JSON.stringify(input.tags),
		defaultMeasureType: measure.type,
		defaultMeasureValue: measure.value
	};
}

export const exerciseRepository = {
	list(query: PageQuery): Page<ExerciseWithUsage> {
		const term = query.search ? `%${query.search}%` : null;
		const filter = term
			? or(
					like(exercises.name, term),
					like(exercises.description, term),
					like(exercises.tags, term)
				)
			: undefined;

		const rows = db
			.select()
			.from(exercises)
			.where(filter)
			.orderBy(asc(exercises.name))
			.limit(query.limit)
			.offset(query.offset)
			.all();

		const total =
			db.select({ value: sql<number>`count(*)` }).from(exercises).where(filter).get()?.value ?? 0;

		const usage = usageByExercise(rows.map((row) => row.id));

		return {
			items: rows.map((row) => ({ ...toExercise(row), sessionCount: usage.get(row.id) ?? 0 })),
			total,
			limit: query.limit,
			offset: query.offset
		};
	},

	findById(id: string): Exercise | null {
		const row = db.select().from(exercises).where(eq(exercises.id, id)).get();
		return row ? toExercise(row) : null;
	},

	findByName(name: string, excludeId?: string): Exercise | null {
		const row = db
			.select()
			.from(exercises)
			.where(
				excludeId
					? and(eq(exercises.name, name), sql`${exercises.id} <> ${excludeId}`)
					: eq(exercises.name, name)
			)
			.get();
		return row ? toExercise(row) : null;
	},

	findManyByIds(ids: string[]): Map<string, Exercise> {
		if (ids.length === 0) return new Map();
		const rows = db.select().from(exercises).where(inArray(exercises.id, ids)).all();
		return new Map(rows.map((row) => [row.id, toExercise(row)]));
	},

	create(input: ExerciseInput): Exercise {
		const now = new Date().toISOString();
		const row = db
			.insert(exercises)
			.values({ id: newId(), ...toRowValues(input), createdAt: now, updatedAt: now })
			.returning()
			.get();
		return toExercise(row);
	},

	update(id: string, patch: ExercisePatch): Exercise | null {
		const current = this.findById(id);
		if (!current) return null;
		const merged: ExerciseInput = {
			name: patch.name ?? current.name,
			description: patch.description ?? current.description,
			instructions: patch.instructions ?? current.instructions,
			category: patch.category ?? current.category,
			tags: patch.tags ?? current.tags,
			defaultMeasure: patch.defaultMeasure !== undefined ? patch.defaultMeasure : current.defaultMeasure
		};
		const row = db
			.update(exercises)
			.set({ ...toRowValues(merged), updatedAt: new Date().toISOString() })
			.where(eq(exercises.id, id))
			.returning()
			.get();
		return row ? toExercise(row) : null;
	},

	remove(id: string): boolean {
		return db.delete(exercises).where(eq(exercises.id, id)).run().changes > 0;
	},

	countUsage(id: string): number {
		return usageByExercise([id]).get(id) ?? 0;
	}
};
