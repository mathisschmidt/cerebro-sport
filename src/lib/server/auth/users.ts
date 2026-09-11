import { asc, count, eq } from 'drizzle-orm';
import { emailForUsername } from '$domain/models/user.ts';
import { db, schema } from '../db/client.ts';

/**
 * Direct reads of Better Auth's user table.
 *
 * Better Auth's own API needs a request context for most of this; these are the
 * few things the app has to know without one — how many accounts exist, and who
 * owns which role.
 */

export function countUsers(): number {
	return db.select({ value: count() }).from(schema.user).get()?.value ?? 0;
}

export function findUserByUsername(name: string) {
	return db
		.select()
		.from(schema.user)
		.where(eq(schema.user.username, name.trim().toLowerCase()))
		.get();
}

export function setUserRole(userId: string, role: 'admin' | 'user'): void {
	db.update(schema.user).set({ role }).where(eq(schema.user.id, userId)).run();
}

/**
 * Renames an account. `name` must already be normalised and validated.
 *
 * The synthesised email moves with the username — otherwise the old name stays
 * reserved and the new one can never be registered by anyone else. Better Auth
 * has no notion of that rule, which is why this is a direct write rather than
 * an `updateUser` followed by a `changeEmail`: one statement, or nothing.
 *
 * Returns false when the name is held by a different account. The check and
 * the write share a transaction, so two renames to the same name cannot both
 * pass the check.
 */
export function renameUser(userId: string, name: string): boolean {
	return db.transaction((tx) => {
		const holder = tx
			.select({ id: schema.user.id })
			.from(schema.user)
			.where(eq(schema.user.username, name))
			.get();
		if (holder && holder.id !== userId) return false;

		tx.update(schema.user)
			.set({ username: name, displayUsername: name, name, email: emailForUsername(name) })
			.where(eq(schema.user.id, userId))
			.run();
		return true;
	});
}

/**
 * The account that stands in for "whoever runs this instance": the longest
 * standing admin, falling back to the longest standing user.
 */
export function findPrimaryUser(): { id: string; username: string | null } | undefined {
	return (
		db
			.select({ id: schema.user.id, username: schema.user.username })
			.from(schema.user)
			.where(eq(schema.user.role, 'admin'))
			.orderBy(asc(schema.user.createdAt))
			.get() ??
		db
			.select({ id: schema.user.id, username: schema.user.username })
			.from(schema.user)
			.orderBy(asc(schema.user.createdAt))
			.get()
	);
}

export function countAdmins(): number {
	return (
		db
			.select({ value: count() })
			.from(schema.user)
			.where(eq(schema.user.role, 'admin'))
			.get()?.value ?? 0
	);
}
