import { and, asc, countDistinct, eq, inArray, like, or, sql } from 'drizzle-orm';
import type { Page, PageQuery } from '$domain/models/common.ts';
import type { Exercise, ExerciseInput, ExercisePatch, ExerciseWithUsage } from '$domain/models/exercise.ts';
import { db, schema } from '../db/client.ts';
import { fromMeasure, toExercise } from '../db/mappers.ts';
import { newId } from '../db/ids.ts';
import { ownedBy } from './scope.ts';

const { exercises, sessionBlocks, sessionItems, sessions } = schema;

/**
 * How many distinct sessions reference each of the given exercises.
 *
 * Joined through to `sessions` and scoped, rather than relying on the callers
 * having passed only this user's exercise ids.
 */
function usageByExercise(userId: string, exerciseIds: string[]): Map<string, number> {
	if (exerciseIds.length === 0) return new Map();
	const rows = db
		.select({
			exerciseId: sessionItems.exerciseId,
			sessions: countDistinct(sessionBlocks.sessionId)
		})
		.from(sessionItems)
		.innerJoin(sessionBlocks, eq(sessionItems.blockId, sessionBlocks.id))
		.innerJoin(sessions, eq(sessionBlocks.sessionId, sessions.id))
		.where(ownedBy(sessions.userId, userId, inArray(sessionItems.exerciseId, exerciseIds)))
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
		customCategory: input.customCategory,
		tags: JSON.stringify(input.tags),
		defaultMeasureType: measure.type,
		defaultMeasureValue: measure.value
	};
}

export const exerciseRepository = {
	list(userId: string, query: PageQuery): Page<ExerciseWithUsage> {
		const term = query.search ? `%${query.search}%` : null;
		const search = term
			? or(
					like(exercises.name, term),
					like(exercises.description, term),
					like(exercises.customCategory, term),
					like(exercises.tags, term)
				)
			: undefined;
		const filter = ownedBy(exercises.userId, userId, search);

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

		const usage = usageByExercise(userId, rows.map((row) => row.id));

		return {
			items: rows.map((row) => ({ ...toExercise(row), sessionCount: usage.get(row.id) ?? 0 })),
			total,
			limit: query.limit,
			offset: query.offset
		};
	},

	findById(userId: string, id: string): Exercise | null {
		const row = db
			.select()
			.from(exercises)
			.where(ownedBy(exercises.userId, userId, eq(exercises.id, id)))
			.get();
		return row ? toExercise(row) : null;
	},

	findByName(userId: string, name: string, excludeId?: string): Exercise | null {
		const row = db
			.select()
			.from(exercises)
			.where(
				ownedBy(
					exercises.userId,
					userId,
					excludeId
						? and(eq(exercises.name, name), sql`${exercises.id} <> ${excludeId}`)
						: eq(exercises.name, name)
				)
			)
			.get();
		return row ? toExercise(row) : null;
	},

	findManyByIds(userId: string, ids: string[]): Map<string, Exercise> {
		if (ids.length === 0) return new Map();
		const rows = db
			.select()
			.from(exercises)
			.where(ownedBy(exercises.userId, userId, inArray(exercises.id, ids)))
			.all();
		return new Map(rows.map((row) => [row.id, toExercise(row)]));
	},

	create(userId: string, input: ExerciseInput): Exercise {
		const now = new Date().toISOString();
		const row = db
			.insert(exercises)
			.values({ id: newId(), userId, ...toRowValues(input), createdAt: now, updatedAt: now })
			.returning()
			.get();
		return toExercise(row);
	},

	update(userId: string, id: string, patch: ExercisePatch): Exercise | null {
		const current = this.findById(userId, id);
		if (!current) return null;
		const merged: ExerciseInput = {
			name: patch.name ?? current.name,
			description: patch.description ?? current.description,
			instructions: patch.instructions ?? current.instructions,
			category: patch.category ?? current.category,
			customCategory:
				patch.customCategory !== undefined ? patch.customCategory : current.customCategory,
			tags: patch.tags ?? current.tags,
			defaultMeasure: patch.defaultMeasure !== undefined ? patch.defaultMeasure : current.defaultMeasure
		};
		const row = db
			.update(exercises)
			.set({ ...toRowValues(merged), updatedAt: new Date().toISOString() })
			.where(ownedBy(exercises.userId, userId, eq(exercises.id, id)))
			.returning()
			.get();
		return row ? toExercise(row) : null;
	},

	remove(userId: string, id: string): boolean {
		return (
			db.delete(exercises).where(ownedBy(exercises.userId, userId, eq(exercises.id, id))).run()
				.changes > 0
		);
	},

	countUsage(userId: string, id: string): number {
		return usageByExercise(userId, [id]).get(id) ?? 0;
	}
};
