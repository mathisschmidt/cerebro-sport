#!/usr/bin/env node
/**
 * Takes a consistent snapshot of the SQLite database while the app is running.
 *
 * `VACUUM INTO` is the safe way to do this: it reads through the same
 * connection machinery as the app, so it cannot catch a half-written page or
 * miss what is still sitting in the WAL — unlike copying the file.
 *
 * Plain JavaScript, and the one place outside `db/client.ts` that names
 * better-sqlite3: it has to run inside the runtime image, which carries no
 * TypeScript sources.
 *
 *   node scripts/backup.mjs [destination-directory]
 */
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';

const source = resolve(process.env.DATABASE_URL ?? './data/app.db');
const target = resolve(process.argv[2] ?? process.env.BACKUP_DIR ?? './backups');
/** Snapshots to keep. Older ones are pruned after a successful run. */
const keep = Number(process.env.BACKUP_KEEP ?? 14);

mkdirSync(target, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = join(target, `app-${stamp}.db`);

const db = new Database(source, { readonly: true, fileMustExist: true });
try {
	// Quoted so a path containing a quote cannot break out of the statement.
	db.exec(`VACUUM INTO '${destination.replace(/'/g, "''")}'`);
} finally {
	db.close();
}

console.log(`Backed up ${source} → ${destination} (${statSync(destination).size} bytes)`);

if (keep > 0) {
	const stale = readdirSync(target)
		.filter((name) => /^app-.*\.db$/.test(name))
		.sort()
		.slice(0, -keep);
	for (const name of stale) {
		unlinkSync(join(target, name));
		console.log(`Pruned ${name}`);
	}
}
