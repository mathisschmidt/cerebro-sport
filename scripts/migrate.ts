import { sql } from 'drizzle-orm';
import { db } from '../src/lib/server/db/client.ts';

/**
 * Applies pending migrations. Importing the client is enough — it migrates on
 * connect — but running it explicitly gives a deploy a step that can fail loudly.
 */
const tables = db.all<{ name: string }>(
	sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name`
);

console.log(`Database ready — ${tables.length} tables:`);
for (const table of tables) console.log(`  · ${table.name}`);
