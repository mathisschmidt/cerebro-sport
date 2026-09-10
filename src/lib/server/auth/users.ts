import { count, eq } from 'drizzle-orm';
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

export function countAdmins(): number {
	return (
		db
			.select({ value: count() })
			.from(schema.user)
			.where(eq(schema.user.role, 'admin'))
			.get()?.value ?? 0
	);
}
