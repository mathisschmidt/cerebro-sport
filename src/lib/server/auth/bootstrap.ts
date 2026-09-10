import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/client.ts';
import { assertProductionReady, auth, emailForUsername } from './auth.ts';
import { countUsers, findPrimaryUser, findUserByUsername, setUserRole } from './users.ts';

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
	/** Who pre-account training data belongs to. */
	ownerId: string;
	created: boolean;
	claimedRows: number;
}

let done: Promise<BootstrapResult> | null = null;

/** Cached so concurrent first requests do not race to create the same admin. */
export function ensureBootstrapped(): Promise<BootstrapResult> {
	done ??= run().catch((error: unknown) => {
		// A rejected promise must not be cached: one transient failure would
		// otherwise brick every later request for the life of the process.
		done = null;
		throw error;
	});
	return done;
}

async function run(): Promise<BootstrapResult> {
	// The first request is the first moment a real environment exists.
	assertProductionReady();

	const name = (process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim().toLowerCase();
	const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

	const configured = findUserByUsername(name);
	if (configured) return settle(configured.id, false);

	/*
	 * The configured admin does not exist. Only create it when nobody does:
	 * an instance that already has accounts already has an administrator, and
	 * the account may well have been renamed or deleted on purpose. Trying to
	 * create one anyway is worse than useless — the sign-up gate refuses it,
	 * and the error used to take every request down with it.
	 */
	if (countUsers() > 0) {
		const primary = findPrimaryUser();
		if (!primary) return { ownerId: '', created: false, claimedRows: 0 };
		return settle(primary.id, false);
	}

	// Empty instance: create the first account, and make it an admin — the
	// plugin defaults new accounts to `user`. The sign-up gate lets this
	// through precisely because there are no users yet.
	const result = await auth.api.signUpEmail({
		body: { name: 'Admin', email: emailForUsername(name), password, username: name }
	});
	setUserRole(result.user.id, 'admin');

	console.log(
		`[auth] created the default admin "${name}"` +
			(password === DEFAULT_ADMIN_PASSWORD ? ' with the default password — change it' : '')
	);

	return settle(result.user.id, true);
}

/** Adopts any orphan rows and reports what happened. */
function settle(ownerId: string, created: boolean): BootstrapResult {
	const claimedRows = claimOrphanRows(ownerId);
	if (claimedRows > 0) {
		console.log(`[auth] assigned ${claimedRows} pre-existing rows to an existing account`);
	}
	return { ownerId, created, claimedRows };
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
