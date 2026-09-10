import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/** Deletes the SQLite file so the next start rebuilds it from migrations. */
const url = process.env.DATABASE_URL?.trim() || './data/app.db';
const file = resolve(process.cwd(), url);

for (const path of [file, `${file}-wal`, `${file}-shm`]) {
	if (existsSync(path)) {
		rmSync(path);
		console.log(`Removed ${path}`);
	}
}
console.log('Database reset. Run `npm run db:seed` to repopulate.');
