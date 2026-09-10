import { createAuthClient } from 'better-auth/svelte';
import { adminClient, usernameClient } from 'better-auth/client/plugins';

/**
 * The browser half of Better Auth.
 *
 * Sign-in, sign-up and sign-out go through here; everything administrative goes
 * through `api.admin` instead, because those responses carry training-data
 * counts that Better Auth knows nothing about.
 */
export const authClient = createAuthClient({
	plugins: [usernameClient(), adminClient()]
});

/** Pulls a readable message out of whatever Better Auth returned. */
export function authErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
	if (typeof error === 'object' && error !== null) {
		const message = (error as { message?: unknown }).message;
		if (typeof message === 'string' && message.trim()) return message;
	}
	return fallback;
}
