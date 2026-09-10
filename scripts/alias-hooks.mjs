import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Teaches plain Node the same `$domain` / `$server` aliases Vite resolves, so
 * CLI scripts can import the real services instead of a parallel copy of them.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ALIASES = {
	$domain: 'src/lib/domain',
	$server: 'src/lib/server',
	$components: 'src/lib/components',
	$client: 'src/lib/client',
	$lib: 'src/lib'
};

export function resolve(specifier, context, next) {
	for (const [alias, target] of Object.entries(ALIASES)) {
		if (specifier === alias || specifier.startsWith(`${alias}/`)) {
			const rest = specifier.slice(alias.length);
			return next(pathToFileURL(path.join(root, target + rest)).href, context);
		}
	}
	return next(specifier, context);
}
