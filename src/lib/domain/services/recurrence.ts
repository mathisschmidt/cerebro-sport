import type { IsoDate } from '../models/common.ts';
import type { Recurrence, Routine } from '../models/routine.ts';
import {
	addDays,
	dayOfMonthOf,
	daysInMonthOf,
	diffInDays,
	diffInMonths,
	eachDay,
	startOfWeek,
	weekdayOf
} from './date.ts';

/**
 * Occurrences are computed, never stored. `occursOn` is the single rule; every
 * expansion below is a loop over it, so adding a recurrence type means touching
 * exactly one switch.
 */

export function occursOn(recurrence: Recurrence, startDate: IsoDate, date: IsoDate): boolean {
	if (date < startDate) return false;

	switch (recurrence.type) {
		case 'once':
			return date === startDate;

		case 'daily':
			return diffInDays(startDate, date) % recurrence.interval === 0;

		case 'weekly': {
			if (!recurrence.weekdays.includes(weekdayOf(date))) return false;
			const weeksApart = Math.round(
				diffInDays(startOfWeek(startDate), startOfWeek(date)) / 7
			);
			return weeksApart % recurrence.interval === 0;
		}

		case 'monthly': {
			if (diffInMonths(startDate, date) % recurrence.interval !== 0) return false;
			// A 31st lands on the last day of shorter months rather than being skipped.
			const target = Math.min(recurrence.dayOfMonth, daysInMonthOf(date));
			return dayOfMonthOf(date) === target;
		}
	}
}

/** Does this routine fire on `date`, honouring its active flag and window? */
export function routineOccursOn(
	routine: Pick<Routine, 'recurrence' | 'startDate' | 'endDate' | 'active'>,
	date: IsoDate
): boolean {
	if (!routine.active) return false;
	if (routine.endDate && date > routine.endDate) return false;
	return occursOn(routine.recurrence, routine.startDate, date);
}

/** Every day in `[from, to]` on which the routine fires. */
export function expandRoutine(
	routine: Pick<Routine, 'recurrence' | 'startDate' | 'endDate' | 'active'>,
	from: IsoDate,
	to: IsoDate
): IsoDate[] {
	if (to < from) return [];
	return eachDay(from, to).filter((day) => routineOccursOn(routine, day));
}

/** First firing on or after `from`, or `null` within the search horizon. */
export function nextOccurrence(
	routine: Pick<Routine, 'recurrence' | 'startDate' | 'endDate' | 'active'>,
	from: IsoDate,
	horizonDays = 400
): IsoDate | null {
	if (!routine.active) return null;
	let cursor = from < routine.startDate ? routine.startDate : from;
	for (let i = 0; i <= horizonDays; i++) {
		if (routine.endDate && cursor > routine.endDate) return null;
		if (routineOccursOn(routine, cursor)) return cursor;
		cursor = addDays(cursor, 1);
	}
	return null;
}
