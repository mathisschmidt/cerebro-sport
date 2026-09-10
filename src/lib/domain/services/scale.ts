/**
 * Axis scales for duration charts.
 *
 * Ticks land on values a person actually says out loud — 30s, 5m, 1h — rather
 * than on whatever a raw min/max division produces. Everything the app plots is
 * a duration, so one helper covers every chart.
 */

/** Steps a duration axis is allowed to use, in seconds. */
const NICE_SECONDS = [
	1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1200, 1800, 2700, 3600, 5400,
	7200, 10_800, 14_400, 21_600, 43_200, 86_400
] as const;

export interface DurationScale {
	/** Rounded domain, in milliseconds. */
	min: number;
	max: number;
	/** Tick values in milliseconds, highest first — the order they are drawn in. */
	ticks: number[];
}

function niceStepMs(spanMs: number, targetTicks: number): number {
	const rawStepSec = spanMs / 1000 / Math.max(1, targetTicks - 1);
	const step = NICE_SECONDS.find((candidate) => candidate >= rawStepSec);
	return (step ?? NICE_SECONDS[NICE_SECONDS.length - 1]!) * 1000;
}

/**
 * A rounded domain covering `[minMs, maxMs]`.
 *
 * `zeroBased` is for bars, which have to grow from zero to stay honest about
 * relative size; lines may start above zero so a small change is still visible.
 */
export function durationScale(
	minMs: number,
	maxMs: number,
	options: { ticks?: number; zeroBased?: boolean } = {}
): DurationScale {
	const targetTicks = options.ticks ?? 3;
	const low = options.zeroBased ? 0 : minMs;
	const span = Math.max(maxMs - low, 1000);

	const step = niceStepMs(span, targetTicks);
	const min = options.zeroBased ? 0 : Math.max(0, Math.floor(low / step) * step);
	const max = Math.max(min + step, Math.ceil(maxMs / step) * step);

	const ticks: number[] = [];
	for (let value = max; value >= min; value -= step) ticks.push(Math.round(value));
	if (ticks[ticks.length - 1] !== min) ticks.push(min);

	return { min, max, ticks };
}
