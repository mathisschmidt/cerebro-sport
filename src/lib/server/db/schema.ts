import { relations, sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Better Auth owns its own tables. Re-exporting them here is what puts them in
 * front of drizzle-kit for migrations and in the drizzle instance the auth
 * adapter is handed.
 */
export * from './auth-schema.ts';

/**
 * SQLite schema, one table per domain concept.
 *
 * Two deliberate choices worth knowing about:
 *  - Measures are stored as (type, value) column pairs rather than JSON, so they
 *    stay queryable and the discriminated union in the domain maps 1:1.
 *  - Workouts snapshot the session plan they ran. History must not change when
 *    a session is later edited, which is also why they hold no foreign key to
 *    the session.
 */

/**
 * Owner of a row. Deliberately no foreign key to `user`: SQLite refuses to add
 * a referencing column with a non-null default to a table that already has
 * rows, and that default is what lets an existing database migrate without
 * losing its data (see `0001` and `claimOrphanRows`). A user's data is removed
 * by `purgeUserData` on the Better Auth delete hook instead.
 */
const owner = {
	userId: text('user_id').notNull()
};

const timestamps = {
	createdAt: text('created_at')
		.notNull()
		.default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
};

export const exercises = sqliteTable(
	'exercises',
	{
		id: text('id').primaryKey(),
		...owner,
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		instructions: text('instructions').notNull().default(''),
		category: text('category').notNull().default('other'),
		/** The athlete's own name for an `other` category; null everywhere else. */
		customCategory: text('custom_category'),
		/** JSON array of strings. */
		tags: text('tags').notNull().default('[]'),
		defaultMeasureType: text('default_measure_type'),
		defaultMeasureValue: real('default_measure_value'),
		...timestamps
	},
	(table) => [
		// Names are unique per athlete, not globally.
		uniqueIndex('exercises_user_name_unique').on(table.userId, table.name),
		index('exercises_user_idx').on(table.userId),
		index('exercises_category_idx').on(table.category)
	]
);

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		...owner,
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		...timestamps
	},
	(table) => [index('sessions_user_idx').on(table.userId, table.name)]
);

export const sessionBlocks = sqliteTable(
	'session_blocks',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => sessions.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		label: text('label').notNull().default(''),
		rounds: integer('rounds').notNull().default(1),
		restBetweenRoundsSec: integer('rest_between_rounds_sec').notNull().default(0),
		restAfterSec: integer('rest_after_sec').notNull().default(0)
	},
	(table) => [index('session_blocks_session_idx').on(table.sessionId, table.position)]
);

export const sessionItems = sqliteTable(
	'session_items',
	{
		id: text('id').primaryKey(),
		blockId: text('block_id')
			.notNull()
			.references(() => sessionBlocks.id, { onDelete: 'cascade' }),
		/** Restricted: an exercise still used by a session cannot be deleted. */
		exerciseId: text('exercise_id')
			.notNull()
			.references(() => exercises.id, { onDelete: 'restrict' }),
		position: integer('position').notNull(),
		measureType: text('measure_type').notNull(),
		measureValue: real('measure_value').notNull(),
		restAfterSec: integer('rest_after_sec').notNull().default(0),
		targetLoad: text('target_load').notNull().default(''),
		notes: text('notes').notNull().default('')
	},
	(table) => [
		index('session_items_block_idx').on(table.blockId, table.position),
		index('session_items_exercise_idx').on(table.exerciseId)
	]
);

export const routines = sqliteTable(
	'routines',
	{
		id: text('id').primaryKey(),
		...owner,
		name: text('name').notNull().default(''),
		sessionId: text('session_id')
			.notNull()
			.references(() => sessions.id, { onDelete: 'cascade' }),
		recurrenceType: text('recurrence_type').notNull(),
		recurrenceInterval: integer('recurrence_interval').notNull().default(1),
		/** JSON array of weekday numbers, 0 = Sunday. Weekly rules only. */
		recurrenceWeekdays: text('recurrence_weekdays').notNull().default('[]'),
		recurrenceDayOfMonth: integer('recurrence_day_of_month'),
		startDate: text('start_date').notNull(),
		endDate: text('end_date'),
		timeOfDay: text('time_of_day'),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		...timestamps
	},
	(table) => [
		index('routines_session_idx').on(table.sessionId),
		index('routines_user_idx').on(table.userId),
		index('routines_active_idx').on(table.active)
	]
);

/**
 * Deviations from a computed schedule. A row exists only once an occurrence has
 * been completed or skipped; everything else is `pending` by absence.
 */
export const routineOccurrences = sqliteTable(
	'routine_occurrences',
	{
		id: text('id').primaryKey(),
		routineId: text('routine_id')
			.notNull()
			.references(() => routines.id, { onDelete: 'cascade' }),
		date: text('date').notNull(),
		status: text('status').notNull(),
		workoutId: text('workout_id'),
		resolvedAt: text('resolved_at').notNull()
	},
	(table) => [
		uniqueIndex('routine_occurrences_unique').on(table.routineId, table.date),
		index('routine_occurrences_date_idx').on(table.date)
	]
);

export const workouts = sqliteTable(
	'workouts',
	{
		id: text('id').primaryKey(),
		...owner,
		/** No foreign key on purpose: history outlives the session it ran. */
		sessionId: text('session_id').notNull(),
		sessionName: text('session_name').notNull(),
		routineId: text('routine_id'),
		occurrenceDate: text('occurrence_date'),
		status: text('status').notNull().default('in_progress'),
		startedAt: text('started_at').notNull(),
		completedAt: text('completed_at'),
		/** Clock span of the step logs, breaks included — see `refreshTotals`. */
		totalMs: integer('total_ms').notNull().default(0),
		completedStepCount: integer('completed_step_count').notNull().default(0),
		plannedStepCount: integer('planned_step_count').notNull().default(0),
		notes: text('notes').notNull().default(''),
		/** Frozen `SessionPlan` as JSON. */
		plan: text('plan').notNull(),
		...timestamps
	},
	(table) => [
		index('workouts_session_idx').on(table.sessionId),
		index('workouts_user_idx').on(table.userId, table.startedAt),
		index('workouts_started_idx').on(table.startedAt),
		index('workouts_status_idx').on(table.status)
	]
);

export const workoutSteps = sqliteTable(
	'workout_steps',
	{
		id: text('id').primaryKey(),
		workoutId: text('workout_id')
			.notNull()
			.references(() => workouts.id, { onDelete: 'cascade' }),
		stepIndex: integer('step_index').notNull(),
		/** Stable across executions — the join key for per-step progress. */
		stepKey: text('step_key').notNull(),
		kind: text('kind').notNull(),
		blockId: text('block_id').notNull(),
		blockIndex: integer('block_index').notNull(),
		itemId: text('item_id'),
		itemIndex: integer('item_index'),
		roundIndex: integer('round_index').notNull(),
		exerciseId: text('exercise_id'),
		exerciseName: text('exercise_name').notNull().default(''),
		plannedMeasureType: text('planned_measure_type'),
		plannedMeasureValue: real('planned_measure_value'),
		plannedRestSec: integer('planned_rest_sec'),
		actualValue: real('actual_value'),
		durationMs: integer('duration_ms').notNull().default(0),
		skipped: integer('skipped', { mode: 'boolean' }).notNull().default(false),
		startedAt: text('started_at').notNull(),
		completedAt: text('completed_at').notNull()
	},
	(table) => [
		uniqueIndex('workout_steps_unique').on(table.workoutId, table.stepIndex),
		index('workout_steps_key_idx').on(table.stepKey),
		index('workout_steps_exercise_idx').on(table.exerciseId)
	]
);

/**
 * Instance-wide settings. Exactly one row, id `app` — a table rather than a
 * config file because an admin toggles it at runtime.
 */
export const settings = sqliteTable('settings', {
	id: text('id').primaryKey(),
	/** When false, only an admin can add users. */
	registrationEnabled: integer('registration_enabled', { mode: 'boolean' })
		.notNull()
		.default(false),
	updatedAt: text('updated_at').notNull()
});

export const sessionsRelations = relations(sessions, ({ many }) => ({
	blocks: many(sessionBlocks),
	routines: many(routines)
}));

export const sessionBlocksRelations = relations(sessionBlocks, ({ one, many }) => ({
	session: one(sessions, { fields: [sessionBlocks.sessionId], references: [sessions.id] }),
	items: many(sessionItems)
}));

export const sessionItemsRelations = relations(sessionItems, ({ one }) => ({
	block: one(sessionBlocks, { fields: [sessionItems.blockId], references: [sessionBlocks.id] }),
	exercise: one(exercises, { fields: [sessionItems.exerciseId], references: [exercises.id] })
}));

export const routinesRelations = relations(routines, ({ one, many }) => ({
	session: one(sessions, { fields: [routines.sessionId], references: [sessions.id] }),
	occurrences: many(routineOccurrences)
}));

export const routineOccurrencesRelations = relations(routineOccurrences, ({ one }) => ({
	routine: one(routines, { fields: [routineOccurrences.routineId], references: [routines.id] })
}));

export const workoutsRelations = relations(workouts, ({ many }) => ({
	steps: many(workoutSteps)
}));

export const workoutStepsRelations = relations(workoutSteps, ({ one }) => ({
	workout: one(workouts, { fields: [workoutSteps.workoutId], references: [workouts.id] })
}));

export type ExerciseRow = typeof exercises.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type SessionBlockRow = typeof sessionBlocks.$inferSelect;
export type SessionItemRow = typeof sessionItems.$inferSelect;
export type RoutineRow = typeof routines.$inferSelect;
export type RoutineOccurrenceRow = typeof routineOccurrences.$inferSelect;
export type WorkoutRow = typeof workouts.$inferSelect;
export type WorkoutStepRow = typeof workoutSteps.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;
