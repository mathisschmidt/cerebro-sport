import type { IsoDate } from '../models/common.ts';
import type {
	AdherenceWindow,
	CalendarDay,
	DurationStats,
	MetricsSnapshot,
	OverviewMetrics,
	SessionMetricPoint,
	SessionMetrics,
	SessionRun,
	StreakMetrics,
	TrendDirection,
	WeeklyVolumePoint
} from '../models/metrics.ts';
import type { RoutineOccurrence } from '../models/routine.ts';
import {
	countsInSessionStats,
	isRecorded,
	workoutOutcome,
	type Workout
} from '../models/workout.ts';
import { addDays, eachDay, isoDateOf, startOfWeek, todayIso } from './date.ts';

/**
 * Every number on the metrics page is derived here, from workouts and computed
 * occurrences. Pure functions with no I/O: the server calls them after loading
 * rows, and they are equally usable in a test or in the browser.
 */

/** Below this, a change is noise rather than progress. */
const FLAT_THRESHOLD_PCT = 3;

export function average(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Latest against the mean of everything before it. Negative means faster. */
export function deltaAgainstHistory(values: number[]): number | null {
	if (values.length < 2) return null;
	const latest = values[values.length - 1] as number;
	const baseline = average(values.slice(0, -1));
	if (baseline <= 0) return null;
	return ((latest - baseline) / baseline) * 100;
}

export function trendOf(deltaPct: number | null): TrendDirection {
	if (deltaPct === null) return 'unknown';
	if (Math.abs(deltaPct) < FLAT_THRESHOLD_PCT) return 'flat';
	return deltaPct < 0 ? 'faster' : 'slower';
}

function statsOf(values: number[]): DurationStats {
	if (values.length === 0) return { first: 0, latest: 0, best: 0, average: 0 };
	return {
		first: values[0] as number,
		latest: values[values.length - 1] as number,
		best: Math.min(...values),
		average: Math.round(average(values))
	};
}

/**
 * One session's history. Workouts must belong to that session.
 *
 * Only fully completed runs feed the duration stats, trend and chart — a run
 * with steps missing is always "faster" and would make progress meaningless.
 * Every recorded run still appears in `runs`, with its outcome.
 */
export function buildSessionMetrics(
	sessionId: string,
	sessionName: string,
	workouts: Workout[]
): SessionMetrics {
	const recorded = workouts
		.filter(isRecorded)
		.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
	const complete = recorded.filter(countsInSessionStats);
	const latest = recorded[recorded.length - 1];

	const history: SessionMetricPoint[] = complete.map((workout) => ({
		workoutId: workout.id,
		date: isoDateOf(workout.startedAt),
		startedAt: workout.startedAt,
		totalMs: workout.totalMs
	}));

	const runs: SessionRun[] = recorded
		.map((workout) => ({
			workoutId: workout.id,
			date: isoDateOf(workout.startedAt),
			startedAt: workout.startedAt,
			outcome: workoutOutcome(workout)
		}))
		.reverse();

	const totals = history.map((point) => point.totalMs);
	const deltaPct = deltaAgainstHistory(totals);

	return {
		sessionId,
		sessionName,
		runCount: complete.length,
		lastRunAt: latest?.startedAt ?? null,
		duration: statsOf(totals),
		deltaPct,
		trend: trendOf(deltaPct),
		history,
		runs
	};
}

/**
 * Streak and adherence over a trailing window.
 *
 * A day counts when every routine due that day was completed. Days with nothing
 * scheduled are neutral: rest days are part of a plan, so they neither extend a
 * streak nor break it. Today is never counted as a miss while it is still
 * running.
 */
export function buildStreakMetrics(
	occurrences: RoutineOccurrence[],
	workouts: Workout[],
	options: { today?: IsoDate; windowDays?: number } = {}
): StreakMetrics {
	const today = options.today ?? todayIso();
	const windowDays = options.windowDays ?? 90;
	const windowStart = addDays(today, -(windowDays - 1));

	const days = new Map<IsoDate, CalendarDay>();
	for (const date of eachDay(windowStart, today)) {
		days.set(date, { date, due: 0, completed: 0, workouts: 0, state: 'idle' });
	}

	for (const occurrence of occurrences) {
		const day = days.get(occurrence.date);
		if (!day) continue;
		day.due += 1;
		if (occurrence.status === 'completed') day.completed += 1;
	}

	for (const workout of workouts) {
		if (!isRecorded(workout)) continue;
		const day = days.get(isoDateOf(workout.startedAt));
		if (!day) continue;
		day.workouts += 1;
	}

	const calendar = [...days.values()];
	for (const day of calendar) day.state = calendarStateOf(day, today);

	// A skipped day is a deliberate deviation and still counts as unhonoured.
	const isHonoured = (day: CalendarDay) => day.due > 0 && day.completed >= day.due;
	const isMissed = (day: CalendarDay) => day.due > 0 && day.completed < day.due;

	let currentStreak = 0;
	for (let i = calendar.length - 1; i >= 0; i--) {
		const day = calendar[i] as CalendarDay;
		const isToday = day.date === today;
		if (isHonoured(day)) {
			currentStreak += 1;
			continue;
		}
		if (isToday) continue; // the day is not over yet
		if (isMissed(day)) break;
		// Nothing was due: a planned rest day, keep walking back.
	}

	let longestStreak = 0;
	let running = 0;
	for (const day of calendar) {
		if (isHonoured(day)) {
			running += 1;
			longestStreak = Math.max(longestStreak, running);
		} else if (isMissed(day) && day.date !== today) {
			running = 0;
		}
	}

	const windowOf = (size: number): AdherenceWindow => {
		const slice = calendar.slice(-size);
		const due = slice.reduce((sum, day) => sum + day.due, 0);
		const completed = slice.reduce((sum, day) => sum + day.completed, 0);
		return { windowDays: size, due, completed, rate: due > 0 ? completed / due : null };
	};

	const todayEntry = days.get(today);

	return {
		currentStreak,
		longestStreak,
		dueToday: todayEntry?.due ?? 0,
		completedToday: todayEntry?.completed ?? 0,
		last7: windowOf(7),
		last30: windowOf(30),
		calendar
	};
}

/**
 * Training done wins, planned or not: a day with a workout is never "missed",
 * even if a second routine due that day was not run.
 */
function calendarStateOf(day: CalendarDay, today: IsoDate): CalendarDay['state'] {
	if (day.workouts > 0 || day.completed > 0) return 'trained';
	if (day.due > 0 && day.date !== today) return 'missed';
	return 'idle';
}

export function buildOverviewMetrics(
	workouts: Workout[],
	options: { today?: IsoDate; weeks?: number } = {}
): OverviewMetrics {
	const today = options.today ?? todayIso();
	const weeks = options.weeks ?? 12;
	const recorded = workouts.filter(isRecorded);
	const complete = recorded.filter(countsInSessionStats);

	const buckets = new Map<IsoDate, WeeklyVolumePoint>();
	const firstWeek = startOfWeek(addDays(today, -(weeks - 1) * 7));
	for (let i = 0; i < weeks; i++) {
		const weekStart = addDays(firstWeek, i * 7);
		buckets.set(weekStart, { weekStart, workouts: 0, totalMs: 0 });
	}

	const activeDays = new Set<IsoDate>();
	const sessions = new Set<string>();
	let totalMs = 0;

	for (const workout of recorded) {
		const date = isoDateOf(workout.startedAt);
		activeDays.add(date);
		sessions.add(workout.sessionId);
		totalMs += workout.totalMs;

		const bucket = buckets.get(startOfWeek(date));
		if (bucket) {
			bucket.workouts += 1;
			bucket.totalMs += workout.totalMs;
		}
	}

	const completeMs = complete.reduce((sum, workout) => sum + workout.totalMs, 0);

	return {
		totalWorkouts: recorded.length,
		totalMs,
		activeDays: activeDays.size,
		sessionsPracticed: sessions.size,
		averageWorkoutMs: complete.length > 0 ? Math.round(completeMs / complete.length) : 0,
		weekly: [...buckets.values()]
	};
}

export function buildMetricsSnapshot(args: {
	workouts: Workout[];
	occurrences: RoutineOccurrence[];
	sessions: Array<{ id: string; name: string }>;
	today?: IsoDate;
}): MetricsSnapshot {
	const bySession = new Map<string, Workout[]>();
	for (const workout of args.workouts) {
		const list = bySession.get(workout.sessionId);
		if (list) list.push(workout);
		else bySession.set(workout.sessionId, [workout]);
	}

	const sessions = args.sessions
		.map((session) =>
			buildSessionMetrics(session.id, session.name, bySession.get(session.id) ?? [])
		)
		.filter((metrics) => metrics.runs.length > 0)
		.sort((a, b) => (b.lastRunAt ?? '').localeCompare(a.lastRunAt ?? ''));

	return {
		overview: buildOverviewMetrics(args.workouts, { today: args.today }),
		streak: buildStreakMetrics(args.occurrences, args.workouts, { today: args.today }),
		sessions
	};
}
