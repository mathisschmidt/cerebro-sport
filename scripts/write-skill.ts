import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildSkillFile } from '../src/lib/domain/services/coach-prompt.ts';

/**
 * Writes the shipped copy of the agent skill file.
 *
 * Its contents are generated from `coach-prompt.ts`, the same source the Coach
 * page serves, so the committed file cannot drift from what the app hands out.
 * Re-run this after changing the pack format.
 */
const target = resolve(process.cwd(), 'skills/van-damme-session-author/SKILL.md');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, buildSkillFile(), 'utf8');
console.log(`Wrote ${target}`);
