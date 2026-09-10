import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { admin, username } from 'better-auth/plugins';
import { db, schema } from '../db/client.ts';
import { countUsers } from './users.ts';
import { purgeUserData } from './purge.ts';
import { settingsService } from '../services/settings.service.ts';

/**
 * The auth instance: accounts, sessions and roles.
 *
 * Deliberately free of `@sveltejs/kit` imports, like every service in this
 * repo, so `scripts/` can create the first admin without booting a server.
 *
 * No mail is configured, so email is not a login factor here — the `username`
 * plugin is what people actually sign in with, and an address is synthesised
 * from it.
 */

/** Sign-in is by username; this fills the address column Better Auth requires. */
export const SYNTHETIC_EMAIL_DOMAIN = 'van-damme.local';

export function emailForUsername(name: string): string {
	return `${name.trim().toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/** Stable across a dev restart, so sessions survive a reload. */
const DEV_SECRET = 'dev-only-insecure-secret-do-not-use-in-production';

export function hasConfiguredSecret(): boolean {
	return Boolean(process.env.BETTER_AUTH_SECRET?.trim());
}

/**
 * Never throws.
 *
 * This module is imported during `vite build` by SvelteKit's analysis pass,
 * where no runtime environment exists yet — so a missing secret cannot be fatal
 * here. `assertProductionReady` makes it fatal at the point it actually
 * matters: serving a request.
 */
function secret(): string {
	return process.env.BETTER_AUTH_SECRET?.trim() || DEV_SECRET;
}

/** Called once from `ensureBootstrapped`, on the first real request. */
export function assertProductionReady(): void {
	if (hasConfiguredSecret()) return;
	if (process.env.NODE_ENV === 'production') {
		throw new Error(
			'BETTER_AUTH_SECRET must be set in production — it signs session cookies.'
		);
	}
	console.warn(
		'[auth] BETTER_AUTH_SECRET is not set; using the development secret. Never do this in production.'
	);
}

/**
 * Self-hosted instances are reached on more than one host — `localhost` from a
 * desktop and a LAN address from the phone during a session — so the origin is
 * resolved per request instead of being pinned. Set `BETTER_AUTH_URL` to pin it
 * behind a real domain.
 */
function baseURL() {
	const fixed = process.env.BETTER_AUTH_URL?.trim();
	if (fixed) return fixed;
	return {
		allowedHosts: [
			'localhost',
			'127.0.0.1',
			'[::1]',
			'*.local',
			'192.168.*.*',
			'10.*.*.*',
			'172.16.*.*',
			'172.17.*.*',
			'172.18.*.*'
		],
		fallback: 'http://localhost:5173',
		protocol: 'http' as const
	};
}

export const auth = betterAuth({
	appName: 'Van Damme',
	secret: secret(),
	baseURL: baseURL(),
	database: drizzleAdapter(db, { provider: 'sqlite', schema }),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		minPasswordLength: 8,
		maxPasswordLength: 128
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24
	},
	plugins: [username(), admin({ defaultRole: 'user', adminRoles: ['admin'] })],

	hooks: {
		/**
		 * Public sign-up is a runtime setting, not a build-time one, so it is
		 * enforced here rather than through `disableSignUp`.
		 *
		 * The empty-instance exception is what lets the very first admin be
		 * created at boot, and doubles as the recovery path if every account is
		 * ever deleted — an instance with no users would otherwise be bricked.
		 * Admins add users through `/admin/create-user`, which is a different
		 * path and so is never gated by this.
		 */
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== '/sign-up/email') return;
			if (countUsers() === 0) return;
			if (settingsService.get().registrationEnabled) return;

			throw new APIError('FORBIDDEN', {
				message: 'Registration is closed. Ask an admin for an account.'
			});
		})
	},

	databaseHooks: {
		user: {
			delete: {
				// Training rows carry no foreign key to `user`, so removing an
				// account has to take its data with it explicitly.
				after: async (deleted) => {
					purgeUserData(deleted.id);
				}
			}
		}
	}
});

export type Auth = typeof auth;
