import { asc, count, eq } from 'drizzle-orm';
import type { CreateUserInput, ManagedUser, SetRoleInput, UserRole } from '$domain/models/user.ts';
import { auth, emailForUsername } from '../auth/auth.ts';
import { countAdmins } from '../auth/users.ts';
import { db, schema } from '../db/client.ts';
import { badRequest, conflict, notFound } from '../http/errors.ts';

/**
 * User administration.
 *
 * Account writes go through Better Auth's admin API so passwords are hashed and
 * its own hooks fire — deleting a user this way is what triggers the purge of
 * their training data. Reads come straight from the tables, because the list
 * also carries counts Better Auth knows nothing about.
 *
 * Takes `headers` rather than a request: like every service here, it stays free
 * of SvelteKit types.
 */

function trainingCounts(): Map<string, { sessions: number; workouts: number }> {
	const counts = new Map<string, { sessions: number; workouts: number }>();

	for (const row of db
		.select({ userId: schema.sessions.userId, value: count() })
		.from(schema.sessions)
		.groupBy(schema.sessions.userId)
		.all()) {
		counts.set(row.userId, { sessions: row.value, workouts: 0 });
	}

	for (const row of db
		.select({ userId: schema.workouts.userId, value: count() })
		.from(schema.workouts)
		.groupBy(schema.workouts.userId)
		.all()) {
		const entry = counts.get(row.userId) ?? { sessions: 0, workouts: 0 };
		entry.workouts = row.value;
		counts.set(row.userId, entry);
	}

	return counts;
}

export const adminService = {
	listUsers(): ManagedUser[] {
		const counts = trainingCounts();
		return db
			.select()
			.from(schema.user)
			.orderBy(asc(schema.user.createdAt))
			.all()
			.map((row) => {
				const owned = counts.get(row.id);
				return {
					id: row.id,
					username: row.username ?? row.name,
					name: row.displayUsername ?? row.name,
					role: (row.role as UserRole | null) ?? 'user',
					createdAt: row.createdAt.toISOString(),
					sessionCount: owned?.sessions ?? 0,
					workoutCount: owned?.workouts ?? 0
				};
			});
	},

	async createUser(headers: Headers, input: CreateUserInput): Promise<ManagedUser> {
		const name = input.username.trim().toLowerCase();

		const taken = db
			.select({ id: schema.user.id })
			.from(schema.user)
			.where(eq(schema.user.username, name))
			.get();
		if (taken) throw conflict(`"${name}" is already taken`, { username: 'Already taken' });

		await auth.api.createUser({
			headers,
			body: {
				name,
				email: emailForUsername(name),
				password: input.password,
				role: input.role,
				data: { username: name, displayUsername: name }
			}
		});

		const created = this.listUsers().find((user) => user.username === name);
		if (!created) throw notFound('User was not created');
		return created;
	},

	async setRole(headers: Headers, actingUserId: string, input: SetRoleInput): Promise<void> {
		if (input.userId === actingUserId && input.role !== 'admin') {
			throw badRequest('You cannot remove your own admin role');
		}
		this.assertNotLastAdmin(input.userId, input.role);

		await auth.api.setRole({ headers, body: { userId: input.userId, role: input.role } });
	},

	async removeUser(headers: Headers, actingUserId: string, userId: string): Promise<void> {
		if (userId === actingUserId) throw badRequest('You cannot delete your own account');
		this.assertNotLastAdmin(userId, 'user');

		// Better Auth's delete hook purges everything this account owned.
		await auth.api.removeUser({ headers, body: { userId } });
	},

	/** An instance with no admin left cannot be administered back. */
	assertNotLastAdmin(userId: string, nextRole: UserRole): void {
		if (nextRole === 'admin') return;
		const target = db
			.select({ role: schema.user.role })
			.from(schema.user)
			.where(eq(schema.user.id, userId))
			.get();
		if (!target) throw notFound('User not found');
		if (target.role === 'admin' && countAdmins() <= 1) {
			throw badRequest('This is the only admin — promote someone else first');
		}
	}
};
