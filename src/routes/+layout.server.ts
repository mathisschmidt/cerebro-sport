import type { LayoutServerLoad } from './$types.ts';

/** The signed-in user, available to every page and the nav. */
export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user });
