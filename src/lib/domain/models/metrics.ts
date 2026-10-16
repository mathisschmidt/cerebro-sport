import type { IsoDate, IsoDateTime, Id } from './common.ts';
import type { WorkoutOutcome } from './workout.ts';

/**
 * Read models. Nothing here is ever received from a client or written to the
 * database — it is all derived from workouts and routines — so these are plain
 * types rather than zod schemas, unlike every entity and input in this folder.
 */

export type TrendDirection = 'faster' | 'slower' | 'flat' | 'unknown';

/** One fully completed run — a point on the session's progress chart. */
export interface SessionMetricPoint {
	workoutId: Id;
	date: IsoDate;
	startedAt: IsoDateTime;
	totalMs: number;
}

/** Any recorded run of a session, for its history list: when, and how it went. */
export interface SessionRun {
	workoutId: Id;
	date: IsoDate;
	startedAt: IsoDateTime;
	outcome: WorkoutOutcome;
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
	/** Fully completed runs. Duration stats, trend and history use only these. */
	runCount: number;
	/** Latest recorded run of any outcome. */
	lastRunAt: IsoDateTime | null;
	duration: DurationStats;
	deltaPct: number | null;
	trend: TrendDirection;
	/** Fully completed runs, oldest first. */
	history: SessionMetricPoint[];
	/** Every recorded run, newest first, each with its outcome. */
	runs: SessionRun[];
}

/**
 * A day on the training calendar:
 *  - `trained` a workout was recorded or a routine ticked off, planned or not
 *  - `missed`  something was due and nothing was done (never today, which is not over)
 *  - `idle`    nothing planned, nothing done
 */
export type CalendarDayState = 'trained' | 'missed' | 'idle';

export interface CalendarDay {
	date: IsoDate;
	due: number;
	completed: number;
	workouts: number;
	state: CalendarDayState;
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
}

export interface OverviewMetrics {
	/** Every recorded workout, whatever its outcome. */
	totalWorkouts: number;
	/** Clock time across those workouts, breaks included. */
	totalMs: number;
	activeDays: number;
	sessionsPracticed: number;
	/** Over fully completed runs only — a half session is not an average session. */
	averageWorkoutMs: number;
	weekly: WeeklyVolumePoint[];
}

export interface MetricsSnapshot {
	overview: OverviewMetrics;
	streak: StreakMetrics;
	sessions: SessionMetrics[];
}
