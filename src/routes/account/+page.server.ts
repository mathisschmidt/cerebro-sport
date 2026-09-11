import { requireUser } from '$server/http/session.ts';
import type { PageServerLoad } from './$types.ts';

/**
 * The layout already exposes the user, but nullable. Re-reading it through
 * `requireUser` is what lets the page treat "signed in" as a given.
 */
export const load: PageServerLoad = ({ locals }) => ({ user: requireUser(locals) });
