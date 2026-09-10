import { building } from '$app/environment';
import { redirect, type Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { UserRole } from '$domain/models/user.ts';
import { ConfigurationError, auth } from '$server/auth/auth.ts';
import { ensureBootstrapped } from '$server/auth/bootstrap.ts';

/**
 * Session resolution and the route guard.
 *
 * Everything is private by default: a route has to be listed below to be
 * reachable signed out. That way a new page is protected because nobody did
 * anything, rather than protected because somebody remembered.
 */

/** Reachable without a session. `/api/health` is how a container is probed. */
const PUBLIC_PATHS = ['/login', '/register', '/api/health'];

/** Better Auth's own endpoints, which must stay open to let people sign in. */
const AUTH_PREFIX = '/api/auth';

/** Signed-in but not an admin gets a 403 here. */
const ADMIN_PREFIX = ['/admin', '/api/admin', '/api/settings'];

function isPublic(pathname: string): boolean {
	return PUBLIC_PATHS.includes(pathname) || pathname.startsWith(AUTH_PREFIX);
}

function isAdminOnly(pathname: string): boolean {
	return ADMIN_PREFIX.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const handle: Handle = async ({ event, resolve }) => {
	// Prerendering must not touch the database or create an admin.
	if (building) return svelteKitHandler({ event, resolve, auth, building });

	// First request of the process creates the default admin and adopts any
	// pre-existing training data. Only a misconfiguration is worth refusing to
	// serve over — anything else is logged, because a boot hiccup must not lock
	// everybody out of an instance that is otherwise fine.
	try {
		await ensureBootstrapped();
	} catch (error) {
		if (error instanceof ConfigurationError) throw error;
		console.error('[auth] bootstrap failed; continuing to serve', error);
	}

	const result = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = result
		? {
				id: result.user.id,
				username: result.user.username ?? result.user.name,
				name: result.user.displayUsername ?? result.user.name,
				role: (result.user.role as UserRole | undefined) ?? 'user'
			}
		: null;
	event.locals.session = result ? { id: result.session.id, expiresAt: result.session.expiresAt } : null;

	const { pathname, search } = event.url;
	const isApi = pathname.startsWith('/api/');

	if (!event.locals.user && !isPublic(pathname)) {
		if (isApi) {
			return Response.json(
				{ error: { code: 'unauthorized', message: 'Sign in to continue', details: null } },
				{ status: 401 }
			);
		}
		// Bring them back where they were once they are in.
		const target = encodeURIComponent(`${pathname}${search}`);
		redirect(303, `/login?redirect=${target}`);
	}

	if (event.locals.user && isAdminOnly(pathname) && event.locals.user.role !== 'admin') {
		if (isApi) {
			return Response.json(
				{ error: { code: 'forbidden', message: 'Admins only', details: null } },
				{ status: 403 }
			);
		}
		redirect(303, '/');
	}

	// Signed-in users have no business on the sign-in screens.
	if (event.locals.user && PUBLIC_PATHS.includes(pathname)) {
		redirect(303, '/');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
