import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/client.ts';
import { assertProductionReady, auth, emailForUsername } from './auth.ts';
import { countUsers, findUserByUsername, setUserRole } from './users.ts';

/**
 * First-boot setup: make sure somebody can sign in, and that no training data
 * is left without an owner.
 *
 * Runs once per process from `hooks.server.ts`, and again from `db:seed`.
 * Everything here is idempotent — a second run is a no-op.
 */

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

export interface BootstrapResult {
	adminId: string;
	created: boolean;
	claimedRows: number;
}

let done: Promise<BootstrapResult> | null = null;

/** Cached so concurrent first requests do not race to create the same admin. */
export function ensureBootstrapped(): Promise<BootstrapResult> {
	done ??= run();
	return done;
}

async function run(): Promise<BootstrapResult> {
	// The first request is the first moment a real environment exists.
	assertProductionReady();

	const name = (process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim().toLowerCase();
	const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

	const existing = findUserByUsername(name);
	let created = false;
	let adminId: string;

	if (existing) {
		adminId = existing.id;
	} else {
		// Goes through the normal sign-up path so the password is hashed by
		// Better Auth. The sign-up gate lets this through because the instance
		// has no users yet.
		const wasEmpty = countUsers() === 0;
		const result = await auth.api.signUpEmail({
			body: {
				name: 'Admin',
				email: emailForUsername(name),
				password,
				username: name
			}
		});
		adminId = result.user.id;
		created = true;
		if (!wasEmpty) {
			console.warn('[auth] created the admin account on a non-empty instance');
		}
	}

	// The admin plugin defaults new accounts to `user`.
	setUserRole(adminId, 'admin');

	const claimedRows = claimOrphanRows(adminId);

	if (created) {
		console.log(
			`[auth] created the default admin "${name}"` +
				(password === DEFAULT_ADMIN_PASSWORD ? ' with the default password — change it' : '')
		);
	}
	if (claimedRows > 0) {
		console.log(`[auth] assigned ${claimedRows} pre-existing rows to "${name}"`);
	}

	return { adminId, created, claimedRows };
}

/**
 * Adopts rows that predate accounts.
 *
 * The `0001` migration backfills `user_id` with `''` so an existing database
 * survives the upgrade; those rows belong to whoever set the instance up.
 */
export function claimOrphanRows(userId: string): number {
	const { exercises, routines, sessions, workouts } = schema;
	let claimed = 0;

	db.transaction((tx) => {
		for (const table of [exercises, sessions, routines, workouts]) {
			claimed += tx
				.update(table)
				.set({ userId })
				.where(eq(table.userId, ''))
				.run().changes;
		}
	});

	return claimed;
}

/** True when the instance has never had an account. */
export function isFreshInstance(): boolean {
	return (
		db.select({ value: sql<number>`count(*)` }).from(schema.user).get()?.value === 0
	);
}
