import type { IsoDate } from '../models/common.ts';

/**
 * Calendar arithmetic on `YYYY-MM-DD` strings.
 *
 * Training days are local calendar days, never instants: a session started at
 * 23:50 belongs to that day, whatever the UTC offset. Every conversion here
 * goes through local midday, which makes the arithmetic immune to DST shifts.
 */

const MS_PER_DAY = 86_400_000;

export function toIsoDate(date: Date): IsoDate {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/** Local Date at midday, so ±1h DST jumps can never change the day. */
export function fromIsoDate(iso: IsoDate): Date {
	const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
	return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function todayIso(now: Date = new Date()): IsoDate {
	return toIsoDate(now);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
	const date = fromIsoDate(iso);
	date.setDate(date.getDate() + days);
	return toIsoDate(date);
}

export function addMonths(iso: IsoDate, months: number): IsoDate {
	const date = fromIsoDate(iso);
	date.setMonth(date.getMonth() + months);
	return toIsoDate(date);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function diffInDays(from: IsoDate, to: IsoDate): number {
	return Math.round((fromIsoDate(to).getTime() - fromIsoDate(from).getTime()) / MS_PER_DAY);
}

export function diffInMonths(from: IsoDate, to: IsoDate): number {
	const a = fromIsoDate(from);
	const b = fromIsoDate(to);
	return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(iso: IsoDate): number {
	return fromIsoDate(iso).getDay();
}

export function daysInMonthOf(iso: IsoDate): number {
	const date = fromIsoDate(iso);
	return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function dayOfMonthOf(iso: IsoDate): number {
	return fromIsoDate(iso).getDate();
}

/** Monday-based by default, matching how training weeks are usually read. */
export function startOfWeek(iso: IsoDate, weekStartsOn = 1): IsoDate {
	const weekday = weekdayOf(iso);
	const delta = (weekday - weekStartsOn + 7) % 7;
	return addDays(iso, -delta);
}

/** Inclusive range, oldest first. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
	const days: IsoDate[] = [];
	const span = diffInDays(from, to);
	for (let i = 0; i <= span; i++) days.push(addDays(from, i));
	return days;
}

export function isBefore(a: IsoDate, b: IsoDate): boolean {
	return a < b;
}

export function clampDate(iso: IsoDate, min: IsoDate, max: IsoDate): IsoDate {
	if (iso < min) return min;
	if (iso > max) return max;
	return iso;
}

/** The local calendar day an instant falls on. */
export function isoDateOf(instant: string | Date): IsoDate {
	return toIsoDate(instant instanceof Date ? instant : new Date(instant));
}

const RELATIVE = new Map<number, string>([
	[0, 'Today'],
	[1, 'Tomorrow'],
	[-1, 'Yesterday']
]);

/** "Today", "Tomorrow", then "Mon 14 Apr" — dropping the year unless it differs. */
export function formatDateLabel(iso: IsoDate, today: IsoDate = todayIso()): string {
	const relative = RELATIVE.get(diffInDays(today, iso));
	if (relative) return relative;
	const date = fromIsoDate(iso);
	const sameYear = date.getFullYear() === fromIsoDate(today).getFullYear();
	return date.toLocaleDateString(undefined, {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		...(sameYear ? {} : { year: 'numeric' })
	});
}

export function formatDateTimeLabel(instant: string): string {
	return new Date(instant).toLocaleString(undefined, {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function nowIso(): string {
	return new Date().toISOString();
}
