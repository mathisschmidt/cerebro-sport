import { and, eq, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

/**
 * Every query against an owned table goes through here.
 *
 * The point is uniformity: a repository method takes `userId` as its first
 * argument and builds its `where` with `ownedBy`, so forgetting to scope a
 * query looks wrong at a glance rather than being invisible.
 */
export function ownedBy(
	column: SQLiteColumn,
	userId: string,
	...clauses: Array<SQL | undefined>
): SQL | undefined {
	return and(eq(column, userId), ...clauses);
}
