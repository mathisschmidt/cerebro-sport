/**
 * Framework-agnostic errors. Services throw these; the HTTP layer is the only
 * thing that turns them into responses, so the same services could be driven by
 * a CLI or a test without importing SvelteKit.
 */

export type AppErrorCode =
	| 'bad_request'
	| 'unauthorized'
	| 'forbidden'
	| 'not_found'
	| 'conflict'
	| 'validation_failed'
	| 'internal';

export class AppError extends Error {
	readonly status: number;
	readonly code: AppErrorCode;
	readonly details: unknown;

	constructor(status: number, code: AppErrorCode, message: string, details?: unknown) {
		super(message);
		this.name = 'AppError';
		this.status = status;
		this.code = code;
		this.details = details ?? null;
	}
}

export const badRequest = (message: string, details?: unknown) =>
	new AppError(400, 'bad_request', message, details);

export const unauthorized = (message = 'Sign in to continue') =>
	new AppError(401, 'unauthorized', message);

export const forbidden = (message = 'You do not have access to this') =>
	new AppError(403, 'forbidden', message);

export const notFound = (message: string) => new AppError(404, 'not_found', message);

export const conflict = (message: string, details?: unknown) =>
	new AppError(409, 'conflict', message, details);

export const validationFailed = (message: string, details?: unknown) =>
	new AppError(422, 'validation_failed', message, details);

export function isAppError(error: unknown): error is AppError {
	return error instanceof AppError;
}
