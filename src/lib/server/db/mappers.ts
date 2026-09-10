import type { Exercise } from '$domain/models/exercise.ts';
import type { Measure, MeasureType } from '$domain/models/common.ts';
import type { SessionPlan } from '$domain/models/plan.ts';
import type { Recurrence, Routine } from '$domain/models/routine.ts';
import type { Workout, WorkoutStepLog } from '$domain/models/workout.ts';
import type { Session, SessionBlock, SessionItem } from './row-types.ts';
import type {
	ExerciseRow,
	RoutineRow,
	SessionBlockRow,
	SessionItemRow,
	SessionRow,
	WorkoutRow,
	WorkoutStepRow
} from './schema.ts';

/**
 * Row ↔ model translation, kept out of the repositories so the mapping rules
 * live in one readable place. Nothing else in the app should know that a
 * measure is two columns or that tags are a JSON string.
 */

function parseJson<T>(raw: string, fallback: T): T {
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function toMeasure(type: string | null, value: number | null): Measure | null {
	if (!type || value === null) return null;
	switch (type as MeasureType) {
		case 'reps':
			return { type: 'reps', value: Math.round(value) };
		case 'time':
			return { type: 'time', value: Math.round(value) };
		case 'distance':
			return { type: 'distance', value };
		default:
			return null;
	}
}

export function fromMeasure(measure: Measure | null): { type: string | null; value: number | null } {
	return measure ? { type: measure.type, value: measure.value } : { type: null, value: null };
}

export function toExercise(row: ExerciseRow): Exercise {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		instructions: row.instructions,
		category: row.category as Exercise['category'],
		tags: parseJson<string[]>(row.tags, []),
		defaultMeasure: toMeasure(row.defaultMeasureType, row.defaultMeasureValue),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export function toSessionItem(row: SessionItemRow): SessionItem {
	const measure = toMeasure(row.measureType, row.measureValue);
	return {
		id: row.id,
		blockId: row.blockId,
		exerciseId: row.exerciseId,
		position: row.position,
		// A row without a valid measure is impossible via the service layer;
		// falling back keeps a corrupted row from taking the whole page down.
		measure: measure ?? { type: 'reps', value: 1 },
		restAfterSec: row.restAfterSec,
		targetLoad: row.targetLoad,
		notes: row.notes
	};
}

export function toSessionBlock(row: SessionBlockRow, items: SessionItem[]): SessionBlock {
	return {
		id: row.id,
		sessionId: row.sessionId,
		position: row.position,
		label: row.label,
		rounds: row.rounds,
		restBetweenRoundsSec: row.restBetweenRoundsSec,
		restAfterSec: row.restAfterSec,
		items
	};
}

export function toSessionCore(row: SessionRow): Session {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export function toRecurrence(row: RoutineRow): Recurrence {
	switch (row.recurrenceType) {
		case 'daily':
			return { type: 'daily', interval: row.recurrenceInterval };
		case 'weekly':
			return {
				type: 'weekly',
				interval: row.recurrenceInterval,
				weekdays: parseJson<number[]>(row.recurrenceWeekdays, [])
			};
		case 'monthly':
			return {
				type: 'monthly',
				interval: row.recurrenceInterval,
				dayOfMonth: row.recurrenceDayOfMonth ?? 1
			};
		default:
			return { type: 'once' };
	}
}

export function fromRecurrence(recurrence: Recurrence): {
	recurrenceType: string;
	recurrenceInterval: number;
	recurrenceWeekdays: string;
	recurrenceDayOfMonth: number | null;
} {
	return {
		recurrenceType: recurrence.type,
		recurrenceInterval: recurrence.type === 'once' ? 1 : recurrence.interval,
		recurrenceWeekdays: JSON.stringify(recurrence.type === 'weekly' ? recurrence.weekdays : []),
		recurrenceDayOfMonth: recurrence.type === 'monthly' ? recurrence.dayOfMonth : null
	};
}

export function toRoutine(row: RoutineRow): Routine {
	return {
		id: row.id,
		name: row.name,
		sessionId: row.sessionId,
		recurrence: toRecurrence(row),
		startDate: row.startDate,
		endDate: row.endDate,
		timeOfDay: row.timeOfDay,
		active: row.active,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export function toWorkout(row: WorkoutRow): Workout {
	return {
		id: row.id,
		sessionId: row.sessionId,
		sessionName: row.sessionName,
		routineId: row.routineId,
		occurrenceDate: row.occurrenceDate,
		status: row.status as Workout['status'],
		startedAt: row.startedAt,
		completedAt: row.completedAt,
		totalMs: row.totalMs,
		activeMs: row.activeMs,
		restMs: row.restMs,
		completedStepCount: row.completedStepCount,
		plannedStepCount: row.plannedStepCount,
		notes: row.notes,
		plan: parseJson<SessionPlan>(row.plan, {
			sessionId: row.sessionId,
			sessionName: row.sessionName,
			sessionDescription: '',
			steps: [],
			estimatedDurationSec: 0
		}),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export function toWorkoutStep(row: WorkoutStepRow): WorkoutStepLog {
	return {
		id: row.id,
		workoutId: row.workoutId,
		stepIndex: row.stepIndex,
		stepKey: row.stepKey,
		kind: row.kind as WorkoutStepLog['kind'],
		blockId: row.blockId,
		blockIndex: row.blockIndex,
		itemId: row.itemId,
		itemIndex: row.itemIndex,
		roundIndex: row.roundIndex,
		exerciseId: row.exerciseId,
		exerciseName: row.exerciseName,
		plannedMeasure: toMeasure(row.plannedMeasureType, row.plannedMeasureValue),
		plannedRestSec: row.plannedRestSec,
		actualValue: row.actualValue,
		durationMs: row.durationMs,
		skipped: row.skipped,
		startedAt: row.startedAt,
		completedAt: row.completedAt
	};
}
