import type { SessionUser } from '$domain/models/user.ts';

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}

		interface Locals {
			/** Populated by `hooks.server.ts` on every request; null when signed out. */
			user: SessionUser | null;
			session: { id: string; expiresAt: Date } | null;
		}

		interface PageData {
			user?: SessionUser | null;
		}
	}
}

export {};
