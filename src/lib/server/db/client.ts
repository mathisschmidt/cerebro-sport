import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.ts';

/**
 * The only place better-sqlite3 is named.
 *
 * Everything above this file talks to the Drizzle instance, so swapping SQLite
 * for Postgres means replacing this module and the dialect in `schema.ts` —
 * repositories, services and routes stay as they are.
 */

export type Database = ReturnType<typeof createDatabase>;

/** The handle passed into `db.transaction(...)`. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Anything that can run a statement — the connection or a transaction. */
export type DbExecutor = Database | Transaction;

const MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle');

function createDatabase(url: string) {
	const file = resolve(process.cwd(), url);
	mkdirSync(dirname(file), { recursive: true });

	const sqlite = new Database(file);
	// WAL keeps reads non-blocking while a workout writes step logs.
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');

	const db = drizzle(sqlite, { schema });

	if (existsSync(MIGRATIONS_FOLDER)) {
		migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
	}

	return db;
}

/**
 * Cached on globalThis so Vite's HMR does not open a new connection — and
 * re-run migrations — on every server module reload.
 */
const globalForDb = globalThis as unknown as { __vanDammeDb?: ReturnType<typeof createDatabase> };

export const db: Database =
	globalForDb.__vanDammeDb ?? (globalForDb.__vanDammeDb = createDatabase(databaseUrl()));

function databaseUrl(): string {
	return process.env.DATABASE_URL?.trim() || './data/app.db';
}

export { schema };
