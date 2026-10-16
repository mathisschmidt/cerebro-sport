import { z } from 'zod';

/**
 * Primitives shared by every model in the domain.
 *
 * Everything the app persists or transports is described here first, then
 * reused. A change to a rule (id shape, date format, measure kinds) happens in
 * this file and propagates to the database mapper, the HTTP layer and the UI.
 */

export const idSchema = z.string().min(1).max(64);
export type Id = z.infer<typeof idSchema>;

/** Calendar day, `YYYY-MM-DD`, always interpreted in the user's local timezone. */
export const isoDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');
export type IsoDate = z.infer<typeof isoDateSchema>;

/** Instant, ISO-8601 with timezone. Stored as text so SQLite stays portable. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;

/** Wall-clock time of day, `HH:MM`. */
export const timeOfDaySchema = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a HH:MM time');
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;

export const timestampsSchema = z.object({
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema
});
export type Timestamps = z.infer<typeof timestampsSchema>;

/**
 * How a piece of work is quantified. One shape for every sport: a number plus
 * the unit it is counted in. `reps` and `distance` are completed by the athlete
 * tapping "done", `time` runs a countdown.
 */
export const measureTypeSchema = z.enum(['reps', 'time', 'distance']);
export type MeasureType = z.infer<typeof measureTypeSchema>;

export const measureSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('reps'), value: z.number().int().min(1).max(10_000) }),
	z.object({ type: z.literal('time'), value: z.number().int().min(1).max(86_400) }),
	z.object({ type: z.literal('distance'), value: z.number().min(1).max(1_000_000) })
]);
export type Measure = z.infer<typeof measureSchema>;

/** True when the athlete has to declare completion themselves. */
export function isSelfPaced(measure: Measure): boolean {
	return measure.type !== 'time';
}

export const MEASURE_UNIT: Record<MeasureType, string> = {
	reps: 'reps',
	time: 'sec',
	distance: 'm'
};

export function formatMeasure(measure: Measure): string {
	switch (measure.type) {
		case 'reps':
			return `${measure.value} reps`;
		case 'time':
			return formatClock(measure.value);
		case 'distance':
			return measure.value >= 1000
				? `${(measure.value / 1000).toFixed(measure.value % 1000 === 0 ? 0 : 2)} km`
				: `${measure.value} m`;
	}
}

/** A duration in seconds, split the way it is said: 1 h 30 min 30 s. */
export interface DurationParts {
	hours: number;
	minutes: number;
	seconds: number;
}

export function durationParts(totalSeconds: number): DurationParts {
	const safe = Math.max(0, Math.round(totalSeconds));
	return {
		hours: Math.floor(safe / 3600),
		minutes: Math.floor((safe % 3600) / 60),
		seconds: safe % 60
	};
}

export function secondsOf(parts: DurationParts): number {
	return parts.hours * 3600 + parts.minutes * 60 + parts.seconds;
}

/** `M:SS`, or `H:MM:SS` past an hour. Used everywhere a duration is shown. */
export function formatClock(totalSeconds: number): string {
	const { hours, minutes, seconds } = durationParts(totalSeconds);
	const pad = (n: number) => String(n).padStart(2, '0');
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Compact human duration for dashboards: `48s`, `12m 30s`, `1h 05m`. */
export function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	if (totalSeconds < 60) return `${totalSeconds}s`;
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
	return seconds === 0 ? `${minutes}m` : `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/** Paged list envelope, used by every collection endpoint. */
export const pageQuerySchema = z.object({
	search: z.string().trim().max(120).optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	offset: z.coerce.number().int().min(0).default(0)
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export interface Page<T> {
	items: T[];
	total: number;
	limit: number;
	offset: number;
}
