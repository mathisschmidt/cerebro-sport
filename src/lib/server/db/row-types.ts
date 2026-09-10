import type { Timestamps } from '$domain/models/common.ts';
import type { SessionBlock, SessionItem } from '$domain/models/session.ts';

/**
 * Server-side intermediate shapes: a session without its blocks hydrated, used
 * while assembling a `SessionDetail`.
 */
export interface Session extends Timestamps {
	id: string;
	name: string;
	description: string;
}

export type { SessionBlock, SessionItem };
