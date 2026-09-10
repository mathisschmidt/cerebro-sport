import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/client.ts';

/**
 * Removes everything an account owns.
 *
 * Called from Better Auth's user-delete hook. Child rows cascade from their
 * parents inside SQLite, but the four owned tables have no foreign key to
 * `user` (see `schema.ts`), so they are cleared here.
 */
export function purgeUserData(userId: string): void {
	const { exercises, routines, routineOccurrences, sessionBlocks, sessionItems, sessions, workouts, workoutSteps } =
		schema;

	db.transaction((tx) => {
		const routineIds = tx
			.select({ id: routines.id })
			.from(routines)
			.where(eq(routines.userId, userId))
			.all()
			.map((row) => row.id);
		if (routineIds.length > 0) {
			tx.delete(routineOccurrences).where(inArray(routineOccurrences.routineId, routineIds)).run();
		}
		tx.delete(routines).where(eq(routines.userId, userId)).run();

		const workoutIds = tx
			.select({ id: workouts.id })
			.from(workouts)
			.where(eq(workouts.userId, userId))
			.all()
			.map((row) => row.id);
		if (workoutIds.length > 0) {
			tx.delete(workoutSteps).where(inArray(workoutSteps.workoutId, workoutIds)).run();
		}
		tx.delete(workouts).where(eq(workouts.userId, userId)).run();

		const sessionIds = tx
			.select({ id: sessions.id })
			.from(sessions)
			.where(eq(sessions.userId, userId))
			.all()
			.map((row) => row.id);
		if (sessionIds.length > 0) {
			const blockIds = tx
				.select({ id: sessionBlocks.id })
				.from(sessionBlocks)
				.where(inArray(sessionBlocks.sessionId, sessionIds))
				.all()
				.map((row) => row.id);
			if (blockIds.length > 0) {
				tx.delete(sessionItems).where(inArray(sessionItems.blockId, blockIds)).run();
			}
			tx.delete(sessionBlocks).where(inArray(sessionBlocks.sessionId, sessionIds)).run();
		}
		tx.delete(sessions).where(eq(sessions.userId, userId)).run();

		// Last: session items reference exercises with onDelete restrict.
		tx.delete(exercises).where(eq(exercises.userId, userId)).run();
	});
}
