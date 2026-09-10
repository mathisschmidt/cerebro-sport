import { randomUUID } from 'node:crypto';

/** Every persisted row gets its id from here. */
export function newId(): string {
	return randomUUID();
}
