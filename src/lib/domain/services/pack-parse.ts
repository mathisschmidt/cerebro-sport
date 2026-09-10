import { z } from 'zod';
import { packSchema, type Pack } from '../models/pack.ts';

/**
 * Turning whatever came back from a chat window into a validated pack.
 *
 * The text arrives via a clipboard, so it is routinely wrapped in a markdown
 * fence, prefixed with "Here's your program!", or carrying a trailing comma.
 * Being tolerant about the envelope while staying strict about the contents is
 * the whole job of this module.
 */

export interface PackIssue {
	level: 'error' | 'warning';
	/** Dotted path into the pack, e.g. `sessions.0.blocks.1.items.0.measure.value`. */
	path: string;
	message: string;
}

export type PackReadResult =
	| { ok: true; pack: Pack; issues: PackIssue[] }
	| { ok: false; issues: PackIssue[] };

/** Pulls the JSON body out of a fenced block, or out of surrounding prose. */
export function extractJsonText(raw: string): string | null {
	const text = raw.trim();
	if (!text) return null;

	// ```json … ``` — take the first fenced block that looks like an object.
	const fence = /```(?:json|jsonc|json5)?\s*\n([\s\S]*?)```/gi;
	for (const match of text.matchAll(fence)) {
		const body = match[1]?.trim();
		if (body && body.startsWith('{')) return body;
	}

	// Otherwise the outermost braces, so leading and trailing prose is ignored.
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) return null;
	return text.slice(start, end + 1);
}

/**
 * Removes trailing commas before `}` or `]`.
 *
 * String-aware, so a comma inside `"notes": "squat, then press,"` survives.
 */
export function stripTrailingCommas(json: string): string {
	let out = '';
	let inString = false;
	let escaped = false;

	for (let i = 0; i < json.length; i++) {
		const char = json[i] as string;

		if (inString) {
			out += char;
			if (escaped) escaped = false;
			else if (char === '\\') escaped = true;
			else if (char === '"') inString = false;
			continue;
		}

		if (char === '"') {
			inString = true;
			out += char;
			continue;
		}

		if (char === ',') {
			// Look ahead past whitespace: a comma before a closer is dead weight.
			let j = i + 1;
			while (j < json.length && /\s/.test(json[j] as string)) j++;
			const next = json[j];
			if (next === '}' || next === ']') continue;
		}

		out += char;
	}

	return out;
}

/** zod issues → the flat, path-addressed shape the UI renders. */
function toIssues(error: z.ZodError): PackIssue[] {
	return error.issues.map((issue) => ({
		level: 'error' as const,
		path: issue.path.join('.') || '(root)',
		message: issue.message
	}));
}

export function readPack(raw: string): PackReadResult {
	const body = extractJsonText(raw);
	if (!body) {
		return {
			ok: false,
			issues: [
				{
					level: 'error',
					path: '(root)',
					message: 'No JSON object found. Paste the whole reply, including the { … } block.'
				}
			]
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(stripTrailingCommas(body));
	} catch (error) {
		return {
			ok: false,
			issues: [
				{
					level: 'error',
					path: '(root)',
					message: `That is not valid JSON: ${error instanceof Error ? error.message : 'unknown error'}`
				}
			]
		};
	}

	const result = packSchema.safeParse(parsed);
	if (!result.success) return { ok: false, issues: toIssues(result.error) };

	const issues: PackIssue[] = [];
	const declared = (parsed as { format?: unknown }).format;
	if (declared !== undefined && declared !== null && typeof declared === 'string') {
		// The literal check already passed if we are here; nothing to add.
	}

	return { ok: true, pack: result.data, issues };
}

/**
 * The issue list as text, ready to paste back into the same chat so the model
 * can correct its own output. Closing that loop is faster than editing JSON by
 * hand.
 */
export function issuesAsFeedback(issues: PackIssue[]): string {
	const lines = issues.map((issue) => `- \`${issue.path}\`: ${issue.message}`);
	return [
		'The file you produced did not validate. Fix exactly these problems and reply with the corrected JSON only:',
		'',
		...lines
	].join('\n');
}
