import { sql } from 'drizzle-orm';
import { ensureBootstrapped } from '../src/lib/server/auth/bootstrap.ts';
import { db, schema } from '../src/lib/server/db/client.ts';
import { newId } from '../src/lib/server/db/ids.ts';
import { exerciseService } from '../src/lib/server/services/exercise.service.ts';
import { routineService } from '../src/lib/server/services/routine.service.ts';
import { sessionService } from '../src/lib/server/services/session.service.ts';
import { buildPlan } from '../src/lib/domain/services/session-plan.ts';
import { addDays, todayIso } from '../src/lib/domain/services/date.ts';
import { routineOccursOn } from '../src/lib/domain/services/recurrence.ts';
import type { ExerciseInput } from '../src/lib/domain/models/exercise.ts';
import type { SessionInput } from '../src/lib/domain/models/session.ts';
import type { PlanStep } from '../src/lib/domain/models/plan.ts';

/**
 * Fills an empty database with a realistic library, two routines and six weeks
 * of history, so the metrics pages have something to say on first run.
 *
 * The library is built through the real services — same validation the app uses.
 * History is written straight to the tables because it needs past timestamps,
 * which the workout service deliberately does not accept.
 */

const EXERCISES: ExerciseInput[] = [
	{
		name: 'Pull-up',
		description: 'Vertical pull from a dead hang.',
		instructions:
			'Grip slightly wider than the shoulders, palms forward. Pull until the chin clears the bar, then lower under control to full extension. No kipping.',
		category: 'strength',
		customCategory: null,
		tags: ['upper body', 'calisthenics', 'back'],
		defaultMeasure: { type: 'reps', value: 8 }
	},
	{
		name: 'Push-up',
		description: 'Horizontal press against bodyweight.',
		instructions:
			'Hands under the shoulders, body in one line from heels to head. Lower until the chest is a fist above the floor, press back up without letting the hips sag.',
		category: 'strength',
		customCategory: null,
		tags: ['upper body', 'calisthenics', 'chest'],
		defaultMeasure: { type: 'reps', value: 15 }
	},
	{
		name: 'Air squat',
		description: 'Bodyweight squat to full depth.',
		instructions:
			'Feet shoulder-width, toes slightly out. Sit back and down until the hip crease drops below the knee, drive through the whole foot to stand.',
		category: 'strength',
		customCategory: null,
		tags: ['lower body', 'calisthenics'],
		defaultMeasure: { type: 'reps', value: 20 }
	},
	{
		name: 'Jumping jack',
		description: 'Full-body warm-up movement.',
		instructions: 'Jump the feet wide while the arms sweep overhead, then back. Stay light on the feet.',
		category: 'cardio',
		customCategory: null,
		tags: ['warm-up', 'conditioning'],
		defaultMeasure: { type: 'reps', value: 30 }
	},
	{
		name: 'Burpee',
		description: 'Squat thrust into a jump.',
		instructions:
			'Drop to a plank, chest to the floor, jump the feet back in, then jump up with the hands overhead. Keep the pace steady rather than sprinting the first ten.',
		category: 'cardio',
		customCategory: null,
		tags: ['conditioning', 'full body'],
		defaultMeasure: { type: 'reps', value: 10 }
	},
	{
		name: 'Plank',
		description: 'Isometric core hold.',
		instructions:
			'Elbows under the shoulders, hips level with the shoulders, ribs pulled down. Squeeze the glutes and breathe.',
		category: 'strength',
		customCategory: null,
		tags: ['core'],
		defaultMeasure: { type: 'time', value: 45 }
	},
	{
		name: 'Mountain climber',
		description: 'Dynamic core and conditioning drill.',
		instructions: 'From a plank, drive the knees to the chest one at a time. Keep the hips low.',
		category: 'cardio',
		customCategory: null,
		tags: ['core', 'conditioning'],
		defaultMeasure: { type: 'time', value: 40 }
	},
	{
		name: 'Sit-up',
		description: 'Trunk flexion against bodyweight.',
		instructions: 'Feet anchored or flat, hands at the temples. Sit all the way up, lower with control.',
		category: 'strength',
		customCategory: null,
		tags: ['core'],
		defaultMeasure: { type: 'reps', value: 20 }
	},
	{
		name: 'Easy run',
		description: 'Conversational-pace running.',
		instructions: 'Nose breathing, relaxed shoulders. If you cannot hold a conversation, slow down.',
		category: 'endurance',
		customCategory: null,
		tags: ['running'],
		defaultMeasure: { type: 'distance', value: 3000 }
	},
	{
		name: 'Shuttle sprint',
		description: '20-metre shuttles at full effort.',
		instructions: 'Sprint out, plant, sprint back. Decelerate through the turn rather than into it.',
		category: 'cardio',
		customCategory: null,
		tags: ['running', 'speed'],
		defaultMeasure: { type: 'distance', value: 200 }
	},
	{
		name: 'Hip mobility flow',
		description: 'Ground-based hip opening sequence.',
		instructions: '90/90 switches, then a deep lunge with a rotation on each side. Move slowly.',
		category: 'mobility',
		customCategory: null,
		tags: ['warm-up', 'mobility'],
		defaultMeasure: { type: 'time', value: 120 }
	},
	{
		name: 'Free-kick drill',
		description: 'Placed strikes from the edge of the box.',
		instructions: 'Five strikes to each corner. Plant foot beside the ball, follow through at the target.',
		category: 'skill',
		customCategory: null,
		tags: ['football', 'technique'],
		defaultMeasure: { type: 'reps', value: 10 }
	}
];

function sessionsFor(byName: Map<string, string>): SessionInput[] {
	const id = (name: string): string => {
		const found = byName.get(name);
		if (!found) throw new Error(`Seed exercise missing: ${name}`);
		return found;
	};

	return [
		{
			name: 'Morning conditioning',
			description: 'Twenty minutes, no equipment, gets the day started.',
			blocks: [
				{
					label: 'Warm-up',
					rounds: 1,
					restBetweenRoundsSec: 0,
					restAfterSec: 60,
					items: [
						{ exerciseId: id('Jumping jack'), measure: { type: 'reps', value: 40 }, restAfterSec: 20, targetLoad: '', notes: '' },
						{ exerciseId: id('Hip mobility flow'), measure: { type: 'time', value: 90 }, restAfterSec: 0, targetLoad: '', notes: '' }
					]
				},
				{
					label: 'Circuit',
					rounds: 5,
					restBetweenRoundsSec: 30,
					restAfterSec: 60,
					items: [
						{ exerciseId: id('Jumping jack'), measure: { type: 'reps', value: 10 }, restAfterSec: 0, targetLoad: '', notes: '' },
						{ exerciseId: id('Push-up'), measure: { type: 'reps', value: 5 }, restAfterSec: 0, targetLoad: '', notes: 'Chest to fist' }
					]
				},
				{
					label: 'Core finisher',
					rounds: 2,
					restBetweenRoundsSec: 45,
					restAfterSec: 0,
					items: [
						{ exerciseId: id('Push-up'), measure: { type: 'reps', value: 5 }, restAfterSec: 15, targetLoad: '', notes: '' },
						{ exerciseId: id('Sit-up'), measure: { type: 'reps', value: 5 }, restAfterSec: 0, targetLoad: '', notes: '' }
					]
				}
			]
		},
		{
			name: 'Full body strength',
			description: 'Three strength blocks with real rest between rounds.',
			blocks: [
				{
					label: 'Pull',
					rounds: 4,
					restBetweenRoundsSec: 90,
					restAfterSec: 120,
					items: [
						{ exerciseId: id('Pull-up'), measure: { type: 'reps', value: 6 }, restAfterSec: 0, targetLoad: 'Bodyweight', notes: 'Full extension at the bottom' }
					]
				},
				{
					label: 'Push & legs',
					rounds: 3,
					restBetweenRoundsSec: 75,
					restAfterSec: 90,
					items: [
						{ exerciseId: id('Push-up'), measure: { type: 'reps', value: 15 }, restAfterSec: 30, targetLoad: '', notes: '' },
						{ exerciseId: id('Air squat'), measure: { type: 'reps', value: 20 }, restAfterSec: 0, targetLoad: '', notes: '' }
					]
				},
				{
					label: 'Core',
					rounds: 3,
					restBetweenRoundsSec: 30,
					restAfterSec: 0,
					items: [
						{ exerciseId: id('Plank'), measure: { type: 'time', value: 45 }, restAfterSec: 15, targetLoad: '', notes: '' },
						{ exerciseId: id('Mountain climber'), measure: { type: 'time', value: 30 }, restAfterSec: 0, targetLoad: '', notes: '' }
					]
				}
			]
		},
		{
			name: 'Sprint intervals',
			description: 'Track work. Short, unpleasant, effective.',
			blocks: [
				{
					label: 'Warm-up',
					rounds: 1,
					restBetweenRoundsSec: 0,
					restAfterSec: 120,
					items: [
						{ exerciseId: id('Easy run'), measure: { type: 'distance', value: 1000 }, restAfterSec: 0, targetLoad: '', notes: 'Easy pace' }
					]
				},
				{
					label: 'Shuttles',
					rounds: 8,
					restBetweenRoundsSec: 60,
					restAfterSec: 180,
					items: [
						{ exerciseId: id('Shuttle sprint'), measure: { type: 'distance', value: 200 }, restAfterSec: 0, targetLoad: '', notes: 'Full effort' }
					]
				},
				{
					label: 'Cool down',
					rounds: 1,
					restBetweenRoundsSec: 0,
					restAfterSec: 0,
					items: [
						{ exerciseId: id('Easy run'), measure: { type: 'distance', value: 800 }, restAfterSec: 0, targetLoad: '', notes: '' },
						{ exerciseId: id('Hip mobility flow'), measure: { type: 'time', value: 120 }, restAfterSec: 0, targetLoad: '', notes: '' }
					]
				}
			]
		}
	];
}

/** Deterministic jitter, so a reseed produces the same history. */
function pseudoRandom(seed: number): number {
	const x = Math.sin(seed) * 10_000;
	return x - Math.floor(x);
}

/**
 * How long a step took on run `runIndex`. Effort drifts a few percent faster
 * over time with noise on top, which is exactly the signal the metrics look for.
 */
function stepDurationMs(step: PlanStep, runIndex: number, seed: number): number {
	if (step.kind === 'rest') return (step.restSec ?? 0) * 1000;
	if (step.measure?.type === 'time') return step.measure.value * 1000;

	const base = step.estimatedSec * 1000;
	const improvement = 1 - Math.min(0.22, runIndex * 0.022);
	const noise = 0.9 + pseudoRandom(seed) * 0.22;
	return Math.round(base * improvement * noise);
}

function seedHistory(
	userId: string,
	sessionId: string,
	sessionName: string,
	routineId: string,
	dates: string[]
): number {
	const detail = sessionService.get(userId, sessionId);
	const plan = buildPlan(detail);
	let written = 0;

	dates.forEach((date, runIndex) => {
		// A believable adherence rate: roughly one session in seven gets missed.
		if (pseudoRandom(runIndex * 7.3 + sessionId.length) < 0.14) return;

		const workoutId = newId();
		let cursor = new Date(`${date}T07:30:00`).getTime();
		const startedAt = new Date(cursor).toISOString();

		// Now and then a run is left part-way, so history shows every outcome:
		// the steps after `stopAfter` are never reached.
		const roll = pseudoRandom(runIndex * 3.1 + sessionId.length * 1.7);
		const keptShare = roll < 0.05 ? 0.4 : roll < 0.1 ? 0.6 : roll < 0.16 ? 0.85 : 1;
		const stopAfter = Math.max(1, Math.round(plan.steps.length * keptShare));
		const finished = stopAfter >= plan.steps.length;

		const rows = plan.steps.slice(0, stopAfter).map((step, stepIndex) => {
			const durationMs = stepDurationMs(step, runIndex, runIndex * 31 + stepIndex);
			const stepStarted = new Date(cursor).toISOString();
			cursor += durationMs;
			const stepCompleted = new Date(cursor).toISOString();

			return {
				id: newId(),
				workoutId,
				stepIndex: step.index,
				stepKey: step.key,
				kind: step.kind,
				blockId: step.blockId,
				blockIndex: step.blockIndex,
				itemId: step.itemId,
				itemIndex: step.itemIndex,
				roundIndex: step.roundIndex,
				exerciseId: step.exerciseId,
				exerciseName: step.exerciseName,
				plannedMeasureType: step.measure?.type ?? null,
				plannedMeasureValue: step.measure?.value ?? null,
				plannedRestSec: step.restSec,
				actualValue:
					step.kind === 'rest'
						? Math.round(durationMs / 1000)
						: step.measure?.type === 'time'
							? Math.round(durationMs / 1000)
							: (step.measure?.value ?? null),
				durationMs,
				skipped: false,
				startedAt: stepStarted,
				completedAt: stepCompleted
			};
		});

		const completedAt = new Date(cursor).toISOString();

		db.transaction((tx) => {
			tx.insert(schema.workouts)
				.values({
					id: workoutId,
					userId,
					sessionId,
					sessionName,
					routineId,
					occurrenceDate: date,
					status: finished ? 'completed' : 'abandoned',
					startedAt,
					completedAt,
					// Step times summed, as `refreshTotals` derives it. The seed never pauses, so
					// that is the span from first step to last.
					totalMs: cursor - new Date(startedAt).getTime(),
					completedStepCount: rows.length,
					plannedStepCount: plan.steps.length,
					notes: '',
					plan: JSON.stringify(plan),
					createdAt: startedAt,
					updatedAt: completedAt
				})
				.run();

			for (const row of rows) tx.insert(schema.workoutSteps).values(row).run();

			// Only a finished run ticks its routine off.
			if (!finished) return;
			tx.insert(schema.routineOccurrences)
				.values({
					id: newId(),
					routineId,
					date,
					status: 'completed',
					workoutId,
					resolvedAt: completedAt
				})
				.onConflictDoNothing()
				.run();
		});

		written += 1;
	});

	return written;
}

async function main(): Promise<void> {
	// The seed belongs to somebody, so the admin has to exist first.
	const { ownerId: adminId } = await ensureBootstrapped();

	const existing = db.get<{ count: number }>(sql`select count(*) as count from exercises`);
	if ((existing?.count ?? 0) > 0) {
		console.log('Database already has data — nothing seeded. Run `npm run db:reset` first to start over.');
		return;
	}

	const byName = new Map<string, string>();
	for (const input of EXERCISES) {
		const created = exerciseService.create(adminId, input);
		byName.set(created.name, created.id);
	}
	console.log(`Created ${byName.size} exercises.`);

	const sessions = sessionsFor(byName).map((input) => sessionService.create(adminId, input));
	console.log(`Created ${sessions.length} sessions.`);

	const today = todayIso();
	const historyStart = addDays(today, -41);

	const [morning, strength, sprints] = sessions;
	if (!morning || !strength || !sprints) throw new Error('Seed sessions missing');

	const routines = [
		routineService.create(adminId, {
			name: 'Morning conditioning',
			sessionId: morning.id,
			recurrence: { type: 'weekly', interval: 1, weekdays: [1, 3, 5] },
			startDate: historyStart,
			endDate: null,
			timeOfDay: '07:30',
			active: true
		}),
		routineService.create(adminId, {
			name: 'Strength day',
			sessionId: strength.id,
			recurrence: { type: 'weekly', interval: 1, weekdays: [2, 6] },
			startDate: historyStart,
			endDate: null,
			timeOfDay: '18:00',
			active: true
		}),
		routineService.create(adminId, {
			name: 'Track intervals',
			sessionId: sprints.id,
			recurrence: { type: 'weekly', interval: 2, weekdays: [4] },
			startDate: historyStart,
			endDate: null,
			timeOfDay: '18:30',
			active: true
		})
	];
	console.log(`Created ${routines.length} routines.`);

	const sessionById = new Map(sessions.map((session) => [session.id, session]));
	let workouts = 0;

	for (const routine of routines) {
		const session = sessionById.get(routine.sessionId);
		if (!session) continue;

		// Only past dates: today's occurrences stay open so the app has something to do.
		const dates: string[] = [];
		for (let offset = -41; offset < 0; offset++) {
			const date = addDays(today, offset);
			if (routineOccursOn(routine, date)) dates.push(date);
		}

		workouts += seedHistory(adminId, session.id, session.name, routine.id, dates);
	}

	console.log(`Logged ${workouts} past workouts.`);
	console.log('\nSeed complete. Run `npm run dev` and open http://localhost:5173');
}

main();
