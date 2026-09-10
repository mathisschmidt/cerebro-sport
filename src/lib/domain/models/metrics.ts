import type { IsoDate, IsoDateTime, Id, Measure } from './common.ts';
import type { PlanStepKind } from './plan.ts';

/**
 * Read models. Nothing here is ever received from a client or written to the
 * database — it is all derived from workouts and routines — so these are plain
 * types rather than zod schemas, unlike every entity and input in this folder.
 */

export type TrendDirection = 'faster' | 'slower' | 'flat' | 'unknown';

/** One execution, reduced to the numbers a chart needs. */
export interface SessionMetricPoint {
	workoutId: Id;
	date: IsoDate;
	startedAt: IsoDateTime;
	totalMs: number;
	activeMs: number;
	restMs: number;
	/** Steps completed over steps planned, 0–1. */
	completionRate: number;
}

export interface StepSample {
	workoutId: Id;
	date: IsoDate;
	durationMs: number;
	actualValue: number | null;
}

/** How one step of a session has evolved across executions. */
export interface StepProgress {
	stepKey: string;
	label: string;
	kind: PlanStepKind;
	blockIndex: number;
	blockLabel: string;
	roundIndex: number;
	roundCount: number;
	itemIndex: number | null;
	exerciseId: Id | null;
	measure: Measure | null;
	samples: StepSample[];
	firstMs: number;
	latestMs: number;
	bestMs: number;
	averageMs: number;
	/** Latest against the average of everything before it. Negative = faster. */
	deltaPct: number | null;
	trend: TrendDirection;
}

export interface DurationStats {
	first: number;
	latest: number;
	best: number;
	average: number;
}

export interface SessionMetrics {
	sessionId: Id;
	sessionName: string;
	runCount: number;
	lastRunAt: IsoDateTime | null;
	duration: DurationStats;
	deltaPct: number | null;
	trend: TrendDirection;
	history: SessionMetricPoint[];
	steps: StepProgress[];
}

export interface CalendarDay {
	date: IsoDate;
	due: number;
	completed: number;
	skipped: number;
	workouts: number;
	activeMs: number;
}

export interface AdherenceWindow {
	windowDays: number;
	due: number;
	completed: number;
	/** completed / due, 0–1. `null` when nothing was due. */
	rate: number | null;
}

export interface StreakMetrics {
	/** Consecutive scheduled days honoured, counting back from today. */
	currentStreak: number;
	longestStreak: number;
	dueToday: number;
	completedToday: number;
	last7: AdherenceWindow;
	last30: AdherenceWindow;
	/** Ordered oldest → newest, one entry per day in the window. */
	calendar: CalendarDay[];
}

export interface WeeklyVolumePoint {
	weekStart: IsoDate;
	workouts: number;
	totalMs: number;
	activeMs: number;
}

export interface OverviewMetrics {
	totalWorkouts: number;
	totalMs: number;
	activeMs: number;
	activeDays: number;
	sessionsPracticed: number;
	averageWorkoutMs: number;
	weekly: WeeklyVolumePoint[];
}

export interface MetricsSnapshot {
	overview: OverviewMetrics;
	streak: StreakMetrics;
	sessions: SessionMetrics[];
}
