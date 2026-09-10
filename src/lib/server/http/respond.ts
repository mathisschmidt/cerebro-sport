import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { AppError, isAppError, validationFailed } from './errors.ts';

/**
 * One request/response contract for every endpoint: validate with a zod schema,
 * return a value, and let thrown `AppError`s become the error body. Handlers
 * never build a Response by hand.
 */

export interface ApiErrorBody {
	error: {
		code: string;
		message: string;
		details: unknown;
	};
}

/** Parses a JSON body against a schema, or throws a 422 with field details. */
export async function readBody<Schema extends z.ZodType>(
	request: Request,
	schema: Schema
): Promise<z.infer<Schema>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw validationFailed('Request body must be valid JSON');
	}
	return parseWith(schema, raw);
}

/** Parses URL search params against a schema. */
export function readQuery<Schema extends z.ZodType>(url: URL, schema: Schema): z.infer<Schema> {
	const raw: Record<string, string> = {};
	for (const [key, value] of url.searchParams) raw[key] = value;
	return parseWith(schema, raw);
}

export function parseWith<Schema extends z.ZodType>(schema: Schema, raw: unknown): z.infer<Schema> {
	const result = schema.safeParse(raw);
	if (!result.success) {
		throw validationFailed('Some fields are invalid', flattenIssues(result.error));
	}
	return result.data;
}

/** `{ "blocks.0.items.1.measure.value": "Too small" }` — directly usable by a form. */
export function flattenIssues(error: z.ZodError): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const issue of error.issues) {
		const path = issue.path.join('.') || '_';
		if (!fields[path]) fields[path] = issue.message;
	}
	return fields;
}

/**
 * Wraps a handler so any `AppError` becomes a structured JSON error and
 * anything unexpected becomes a 500 without leaking internals.
 */
export function endpoint<T>(
	handler: (event: Parameters<RequestHandler>[0]) => Promise<T> | T,
	options: { status?: number } = {}
): RequestHandler {
	return async (event) => {
		try {
			const result = await handler(event);
			if (result instanceof Response) return result;
			if (result === undefined || result === null) return new Response(null, { status: 204 });
			return json(result, { status: options.status ?? 200 });
		} catch (error) {
			return errorResponse(error);
		}
	};
}

export function errorResponse(error: unknown): Response {
	if (isAppError(error)) {
		const body: ApiErrorBody = {
			error: { code: error.code, message: error.message, details: error.details }
		};
		return json(body, { status: error.status });
	}

	console.error('[api] unhandled error', error);
	const body: ApiErrorBody = {
		error: { code: 'internal', message: 'Something went wrong', details: null }
	};
	return json(body, { status: 500 });
}

export { AppError };
