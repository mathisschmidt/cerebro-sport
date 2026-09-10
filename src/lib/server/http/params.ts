import { badRequest } from './errors.ts';

/** Route params are typed as possibly-absent; this asserts the one we routed on. */
export function requireParam(
	params: Partial<Record<string, string>>,
	name: string
): string {
	const value = params[name];
	if (!value) throw badRequest(`Missing ${name}`);
	return value;
}
