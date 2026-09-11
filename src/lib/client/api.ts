import type { Page, PageQuery } from '$domain/models/common.ts';
import type {
	Exercise,
	ExerciseInput,
	ExercisePatch,
	ExerciseWithUsage
} from '$domain/models/exercise.ts';
import type { MetricsSnapshot, SessionMetrics } from '$domain/models/metrics.ts';
import type { ImportOptions, ImportResult, Pack } from '$domain/models/pack.ts';
import type { AppSettings, AppSettingsPatch } from '$domain/models/settings.ts';
import type {
	ChangeUsernameInput,
	CreateUserInput,
	ManagedUser,
	SessionUser,
	SetRoleInput
} from '$domain/models/user.ts';
import type {
	OccurrenceResolution,
	RoutineDetail,
	RoutineInput,
	RoutineOccurrence,
	RoutinePatch
} from '$domain/models/routine.ts';
import type { SessionDetail, SessionInput, SessionSummary } from '$domain/models/session.ts';
import type {
	Workout,
	WorkoutDetail,
	WorkoutFinish,
	WorkoutQuery,
	WorkoutStart,
	WorkoutStepLogInput
} from '$domain/models/workout.ts';

/**
 * The typed client for `/api`. Every call goes through `request`, so error
 * handling, JSON encoding and field-level validation errors behave identically
 * everywhere in the UI.
 */

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;
	/** Field name → message, ready to drop into a form. */
	readonly fields: Record<string, string>;

	constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
		this.fields = fields;
	}
}

type FetchLike = typeof globalThis.fetch;

async function request<T>(
	method: string,
	path: string,
	options: { body?: unknown; fetch?: FetchLike } = {}
): Promise<T> {
	const doFetch = options.fetch ?? globalThis.fetch;
	const response = await doFetch(path, {
		method,
		headers: options.body === undefined ? {} : { 'content-type': 'application/json' },
		body: options.body === undefined ? undefined : JSON.stringify(options.body)
	});

	if (response.status === 204) return undefined as T;

	const payload = await response.json().catch(() => null);

	if (!response.ok) {
		const error = (payload as { error?: { code?: string; message?: string; details?: unknown } })
			?.error;
		const details = error?.details;
		throw new ApiError(
			response.status,
			error?.code ?? 'internal',
			error?.message ?? 'Request failed',
			details && typeof details === 'object' ? (details as Record<string, string>) : {}
		);
	}

	return payload as T;
}

function query(params: Record<string, string | number | undefined | null>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
	}
	const asString = search.toString();
	return asString ? `?${asString}` : '';
}

export const api = {
	exercises: {
		list: (params: Partial<PageQuery> = {}, fetch?: FetchLike) =>
			request<Page<ExerciseWithUsage>>('GET', `/api/exercises${query(params)}`, { fetch }),
		get: (id: string, fetch?: FetchLike) =>
			request<Exercise>('GET', `/api/exercises/${id}`, { fetch }),
		create: (body: ExerciseInput) => request<Exercise>('POST', '/api/exercises', { body }),
		update: (id: string, body: ExercisePatch) =>
			request<Exercise>('PATCH', `/api/exercises/${id}`, { body }),
		remove: (id: string) => request<void>('DELETE', `/api/exercises/${id}`)
	},

	sessions: {
		list: (params: Partial<PageQuery> = {}, fetch?: FetchLike) =>
			request<Page<SessionSummary>>('GET', `/api/sessions${query(params)}`, { fetch }),
		get: (id: string, fetch?: FetchLike) =>
			request<SessionDetail>('GET', `/api/sessions/${id}`, { fetch }),
		create: (body: SessionInput) => request<SessionDetail>('POST', '/api/sessions', { body }),
		update: (id: string, body: SessionInput) =>
			request<SessionDetail>('PUT', `/api/sessions/${id}`, { body }),
		remove: (id: string) => request<void>('DELETE', `/api/sessions/${id}`)
	},

	routines: {
		list: (fetch?: FetchLike) => request<RoutineDetail[]>('GET', '/api/routines', { fetch }),
		create: (body: RoutineInput) => request<RoutineDetail>('POST', '/api/routines', { body }),
		update: (id: string, body: RoutinePatch) =>
			request<RoutineDetail>('PATCH', `/api/routines/${id}`, { body }),
		remove: (id: string) => request<void>('DELETE', `/api/routines/${id}`),
		occurrences: (params: { from: string; to: string }, fetch?: FetchLike) =>
			request<RoutineOccurrence[]>('GET', `/api/routines/occurrences${query(params)}`, { fetch }),
		resolve: (body: OccurrenceResolution) =>
			request<RoutineOccurrence>('POST', '/api/routines/occurrences', { body })
	},

	workouts: {
		list: (params: Partial<WorkoutQuery> = {}, fetch?: FetchLike) =>
			request<Workout[]>('GET', `/api/workouts${query(params)}`, { fetch }),
		start: (body: WorkoutStart) => request<WorkoutDetail>('POST', '/api/workouts', { body }),
		get: (id: string, fetch?: FetchLike) =>
			request<WorkoutDetail>('GET', `/api/workouts/${id}`, { fetch }),
		active: (fetch?: FetchLike) =>
			request<Workout | null>('GET', '/api/workouts/active', { fetch }),
		logStep: (id: string, body: WorkoutStepLogInput) =>
			request<void>('POST', `/api/workouts/${id}/steps`, { body }),
		finish: (id: string, body: WorkoutFinish) =>
			request<WorkoutDetail>('POST', `/api/workouts/${id}/finish`, { body }),
		remove: (id: string) => request<void>('DELETE', `/api/workouts/${id}`)
	},

	settings: {
		get: (fetch?: FetchLike) => request<AppSettings>('GET', '/api/settings', { fetch }),
		update: (body: AppSettingsPatch) => request<AppSettings>('PATCH', '/api/settings', { body })
	},

	account: {
		/** Renames the signed-in user; the returned user is what the nav should show now. */
		changeUsername: (body: ChangeUsernameInput) =>
			request<SessionUser>('PATCH', '/api/account', { body })
	},

	admin: {
		users: (fetch?: FetchLike) => request<ManagedUser[]>('GET', '/api/admin/users', { fetch }),
		createUser: (body: CreateUserInput) =>
			request<ManagedUser>('POST', '/api/admin/users', { body }),
		setRole: (body: SetRoleInput) => request<ManagedUser[]>('PATCH', '/api/admin/users', { body }),
		removeUser: (userId: string) =>
			request<void>('DELETE', '/api/admin/users', { body: { userId } })
	},

	packs: {
		/** Import a training pack produced by the Coach page. */
		import: (pack: Pack, options: ImportOptions) =>
			request<ImportResult>('POST', '/api/packs', { body: { pack, options } })
	},

	metrics: {
		snapshot: (fetch?: FetchLike) => request<MetricsSnapshot>('GET', '/api/metrics', { fetch }),
		forSession: (sessionId: string, fetch?: FetchLike) =>
			request<SessionMetrics>('GET', `/api/metrics/sessions/${sessionId}`, { fetch })
	}
};
