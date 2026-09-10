import type { SessionUser } from '$domain/models/user.ts';
import { forbidden, unauthorized } from './errors.ts';

/**
 * Reading the signed-in user out of `locals`.
 *
 * `hooks.server.ts` already turns anonymous page requests into a redirect, so
 * these throwing helpers are the backstop for endpoints and the single place
 * that decides what "signed in" and "admin" mean.
 */

export function requireUser(locals: App.Locals): SessionUser {
	if (!locals.user) throw unauthorized();
	return locals.user;
}

export function requireAdmin(locals: App.Locals): SessionUser {
	const user = requireUser(locals);
	if (user.role !== 'admin') throw forbidden('Admins only');
	return user;
}
