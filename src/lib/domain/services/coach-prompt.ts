import { measureTypeSchema, type IsoDate } from '../models/common.ts';
import { exerciseCategorySchema } from '../models/exercise.ts';
import { PACK_FORMAT, PACK_VERSION, WEEKDAY_NAMES } from '../models/pack.ts';
import { todayIso } from './date.ts';

/**
 * Builds the prompt the athlete copies into any chat model, and the skill file
 * they can hand to their own agent.
 *
 * The format rules are written once, in `formatSpec()`, and reused by both —
 * and the enumerations inside it come from the zod schemas, so a new exercise
 * category or measure type shows up in the prompt without anyone remembering to
 * update prose.
 */

export type ExercisePolicy = 'library-only' | 'prefer-library' | 'free';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type MeasurePreference = 'mixed' | 'reps' | 'time';

/**
 * The brief. Only the goal is always there — every other field is `null` until
 * the athlete turns that option on, so the brief carries what was actually
 * asked for rather than defaults nobody chose. The form reveals an input only
 * for the fields that are not null, and the prompt mentions only those.
 */
export interface CoachBrief {
	/** The free-text ask. Everything else is a refinement of it. */
	goal: string;
	discipline: string | null;
	level: Level | null;
	sessionCount: number | null;
	minutesPerSession: number | null;
	daysPerWeek: number | null;
	equipment: string | null;
	constraints: string | null;
	exercisePolicy: ExercisePolicy | null;
	mustInclude: string[] | null;
	avoid: string[] | null;
	measurePreference: MeasurePreference | null;
	/** Asking for a schedule is a yes/no, so it has no value to hold. */
	includeRoutines: boolean;
	notes: string | null;
}

/** The fields the form keeps behind a toggle — everything with an off state. */
export type BriefOption = Exclude<keyof CoachBrief, 'goal' | 'includeRoutines'>;

/**
 * What a field is worth the moment its toggle is switched on. It lives next to
 * the brief rather than in the form so there is one definition of each default.
 */
export const BRIEF_DEFAULTS: { [K in BriefOption]: NonNullable<CoachBrief[K]> } = {
	discipline: '',
	level: 'intermediate',
	sessionCount: 3,
	minutesPerSession: 30,
	daysPerWeek: 3,
	equipment: '',
	constraints: '',
	exercisePolicy: 'prefer-library',
	mustInclude: [],
	avoid: [],
	measurePreference: 'mixed',
	notes: ''
};

/**
 * Turns one option on — giving it the value it takes when first asked for — or
 * off again, which forgets whatever was in it. A switch rather than a generic
 * write so every field keeps its own type and a missing option is a type error.
 */
export function setBriefOption(brief: CoachBrief, key: BriefOption, on: boolean): CoachBrief {
	switch (key) {
		case 'discipline':
			return { ...brief, discipline: on ? BRIEF_DEFAULTS.discipline : null };
		case 'level':
			return { ...brief, level: on ? BRIEF_DEFAULTS.level : null };
		case 'sessionCount':
			return { ...brief, sessionCount: on ? BRIEF_DEFAULTS.sessionCount : null };
		case 'minutesPerSession':
			return { ...brief, minutesPerSession: on ? BRIEF_DEFAULTS.minutesPerSession : null };
		case 'daysPerWeek':
			return { ...brief, daysPerWeek: on ? BRIEF_DEFAULTS.daysPerWeek : null };
		case 'equipment':
			return { ...brief, equipment: on ? BRIEF_DEFAULTS.equipment : null };
		case 'constraints':
			return { ...brief, constraints: on ? BRIEF_DEFAULTS.constraints : null };
		case 'exercisePolicy':
			return { ...brief, exercisePolicy: on ? BRIEF_DEFAULTS.exercisePolicy : null };
		case 'mustInclude':
			return { ...brief, mustInclude: on ? [...BRIEF_DEFAULTS.mustInclude] : null };
		case 'avoid':
			return { ...brief, avoid: on ? [...BRIEF_DEFAULTS.avoid] : null };
		case 'measurePreference':
			return { ...brief, measurePreference: on ? BRIEF_DEFAULTS.measurePreference : null };
		case 'notes':
			return { ...brief, notes: on ? BRIEF_DEFAULTS.notes : null };
	}
}

/** An untouched brief: the goal, and nothing asked for yet. */
export function emptyBrief(): CoachBrief {
	return {
		goal: '',
		discipline: null,
		level: null,
		sessionCount: null,
		minutesPerSession: null,
		daysPerWeek: null,
		equipment: null,
		constraints: null,
		exercisePolicy: null,
		mustInclude: null,
		avoid: null,
		measurePreference: null,
		includeRoutines: false,
		notes: null
	};
}

/**
 * Whether the brief asks for sessions at all. The three session-shaping options
 * are optional, and with none of them set the athlete wants something smaller:
 * a schedule over the sessions they already have, or just the exercises.
 */
export function wantsSessions(brief: CoachBrief): boolean {
	return (
		brief.sessionCount !== null || brief.minutesPerSession !== null || brief.daysPerWeek !== null
	);
}

/** What the prompt is about to ask for, so an empty brief cannot surprise. */
export function describeAsk(brief: CoachBrief): string {
	if (wantsSessions(brief)) {
		const count =
			brief.sessionCount === null
				? 'sessions'
				: `${brief.sessionCount} session${brief.sessionCount === 1 ? '' : 's'}`;
		const schedule = brief.includeRoutines ? ', a weekly schedule' : '';
		return `${count}${schedule} and the exercises they need`;
	}
	if (brief.includeRoutines) return 'a weekly schedule built from the sessions you already have';
	return 'exercises only — no sessions, no schedule';
}

const POLICY_TEXT: Record<ExercisePolicy, string> = {
	'library-only':
		'Use ONLY exercises from the existing library listed above. Do not invent any new exercise. If the library cannot cover the request, say so in "summary" and build the best session you can from what is there.',
	'prefer-library':
		'Prefer exercises from the existing library — reuse an existing name whenever it fits. Add new exercises only where the library genuinely has no equivalent, and describe each new one fully in "exercises".',
	free: 'Invent whatever exercises the program needs. Still reuse an existing name when it means the same movement, so history stays connected.'
};

const MEASURE_TEXT: Record<MeasurePreference, string> = {
	mixed: 'Use whichever of reps / time / distance suits each movement.',
	reps: 'Prefer rep counts. Use time only for holds and other movements that have no natural rep.',
	time: 'Prefer timed intervals. Use reps only where a time-based version makes no sense.'
};

const LEVEL_TEXT: Record<Level, string> = {
	beginner: 'Beginner — conservative volume, generous rest, emphasis on form cues.',
	intermediate: 'Intermediate — comfortable with the basics, can sustain moderate volume.',
	advanced: 'Advanced — high work capacity, tolerates dense circuits and short rest.'
};

function bullet(label: string, value: string | undefined | null): string | null {
	const text = value?.trim();
	return text ? `- **${label}:** ${text}` : null;
}

/**
 * The format contract. This is the part that must be exactly right — everything
 * else in the prompt is context around it.
 */
export function formatSpec(): string {
	const categories = exerciseCategorySchema.options.join(' | ');
	const measures = measureTypeSchema.options.join(' | ');
	const weekdays = WEEKDAY_NAMES.join(' | ');

	return `## Output format

Return a single JSON object — the "training pack".

\`\`\`
{
  "format": "${PACK_FORMAT}",
  "version": ${PACK_VERSION},
  "summary": string,            // one or two sentences about what you built, and any caveat
  "exercises": Exercise[],      // every NEW movement the sessions use
  "sessions": Session[],        // the workouts themselves
  "routines": Routine[]         // optional schedule; omit or leave [] if not asked for
}
\`\`\`

### Exercise

\`\`\`
{
  "name": string,               // 1-80 chars, unique, the key sessions refer to
  "description": string,        // what the movement IS, one or two sentences
  "instructions": string,       // HOW to perform it: setup, execution, form cues.
                                // This is displayed on the phone mid-set, so make it useful.
  "category": ${categories},
  "tags": string[],             // 0-12 short tags, e.g. ["upper body", "no equipment"]
  "defaultMeasure": Measure | null
}
\`\`\`

### Measure — how a set is counted

\`\`\`
{ "type": "reps",     "value": integer }   // repetitions, 1-10000
{ "type": "time",     "value": integer }   // SECONDS, 1-86400
{ "type": "distance", "value": number  }   // METRES, 1-1000000
\`\`\`

Allowed types: ${measures}. \`time\` runs a countdown in the app; \`reps\` and
\`distance\` wait for the athlete to tap "done".

### Session

\`\`\`
{
  "name": string,               // 1-80 chars, unique within the pack
  "description": string,        // 0-2000 chars
  "blocks": Block[]             // at least one
}
\`\`\`

### Block — one circuit, repeated

\`\`\`
{
  "label": string,              // 0-80 chars, e.g. "Warm-up", "Main circuit", "Finisher"
  "rounds": integer,            // 1-100, how many times the whole item list repeats
  "restBetweenRoundsSec": integer,  // 0-3600, rest after each round except the last
  "restAfterSec": integer,      // 0-3600, rest after the block; ignored on the last block
  "items": Item[]               // at least one
}
\`\`\`

### Item — one exercise inside a block

\`\`\`
{
  "exercise": string,           // EXACT name of an exercise, matched case-insensitively
  "measure": Measure,
  "restAfterSec": integer,      // 0-3600, rest before the next item in the same round
  "targetLoad": string,         // 0-40 chars, free text: "20 kg", "red band", "bodyweight"
  "notes": string               // 0-500 chars, a cue shown during the set
}
\`\`\`

### Routine — a session on repeat

\`\`\`
{
  "name": string,               // 0-80 chars; defaults to the session name if empty
  "session": string,            // name of a session in this pack, or one already in the library
  "recurrence": Recurrence,
  "startDate": "YYYY-MM-DD",    // optional, defaults to the day of import
  "endDate": "YYYY-MM-DD" | null,
  "timeOfDay": "HH:MM" | null   // informative ordering only, it does not notify
}
\`\`\`

\`\`\`
{ "type": "once" }
{ "type": "daily",   "interval": integer }                          // every N days
{ "type": "weekly",  "interval": integer, "weekdays": string[] }    // ${weekdays}
{ "type": "monthly", "interval": integer, "dayOfMonth": integer }   // 1-31
\`\`\`

## The rules that matter

1. **Every \`item.exercise\` must name an exercise** that is either in the
   existing library or defined in this pack's \`exercises\` array. Spell it
   identically in both places.
2. **Rest belongs to the thing you rest after.** Rest between two items in the
   same round is that item's \`restAfterSec\`. Rest between rounds is the
   block's \`restBetweenRoundsSec\`. Rest between blocks is the block's
   \`restAfterSec\`. Never create a separate "rest exercise".
3. **A block is a circuit, not a single set.** "4 sets of 6 pull-ups with 90s
   rest" is ONE block with \`rounds: 4\` and \`restBetweenRoundsSec: 90\` — not
   four blocks.
4. Warm-up, main work and cool-down are usually separate blocks with
   \`rounds: 1\` unless they genuinely repeat.
5. All durations are **integer seconds**. All distances are **metres**. Never
   write "30s", "1:30" or "2 min" — write \`30\`, \`90\`, \`120\`.
6. Session names must be unique within the pack.
7. Write \`instructions\` for every new exercise as if the reader has never done
   it. That text is what the athlete reads mid-set.

## Worked example

"5 rounds of (10 jumping jacks + 5 push-ups) with 30s rest between rounds, then
2 rounds of (5 push-ups + 5 sit-ups)" is exactly two blocks:

\`\`\`json
{
  "format": "${PACK_FORMAT}",
  "version": ${PACK_VERSION},
  "summary": "A short bodyweight conditioning session, no equipment.",
  "exercises": [
    {
      "name": "Jumping jack",
      "description": "Full-body warm-up movement.",
      "instructions": "Jump the feet wide while the arms sweep overhead, then back. Stay light on the feet and keep a steady rhythm.",
      "category": "cardio",
      "tags": ["warm-up", "no equipment"],
      "defaultMeasure": { "type": "reps", "value": 30 }
    },
    {
      "name": "Push-up",
      "description": "Horizontal press against bodyweight.",
      "instructions": "Hands under the shoulders, body in one line from heels to head. Lower until the chest is a fist above the floor, then press back up without letting the hips sag.",
      "category": "strength",
      "tags": ["upper body", "no equipment"],
      "defaultMeasure": { "type": "reps", "value": 15 }
    },
    {
      "name": "Sit-up",
      "description": "Trunk flexion against bodyweight.",
      "instructions": "Feet flat or anchored, hands at the temples. Sit all the way up, then lower with control rather than dropping.",
      "category": "strength",
      "tags": ["core"],
      "defaultMeasure": { "type": "reps", "value": 20 }
    }
  ],
  "sessions": [
    {
      "name": "Bodyweight conditioning",
      "description": "Two circuits, about fifteen minutes, no equipment.",
      "blocks": [
        {
          "label": "Circuit",
          "rounds": 5,
          "restBetweenRoundsSec": 30,
          "restAfterSec": 60,
          "items": [
            {
              "exercise": "Jumping jack",
              "measure": { "type": "reps", "value": 10 },
              "restAfterSec": 0,
              "targetLoad": "",
              "notes": ""
            },
            {
              "exercise": "Push-up",
              "measure": { "type": "reps", "value": 5 },
              "restAfterSec": 0,
              "targetLoad": "",
              "notes": "Chest to a fist above the floor"
            }
          ]
        },
        {
          "label": "Core finisher",
          "rounds": 2,
          "restBetweenRoundsSec": 45,
          "restAfterSec": 0,
          "items": [
            {
              "exercise": "Push-up",
              "measure": { "type": "reps", "value": 5 },
              "restAfterSec": 15,
              "targetLoad": "",
              "notes": ""
            },
            {
              "exercise": "Sit-up",
              "measure": { "type": "reps", "value": 5 },
              "restAfterSec": 0,
              "targetLoad": "",
              "notes": ""
            }
          ]
        }
      ]
    }
  ],
  "routines": []
}
\`\`\``;
}

export interface PromptContext {
	/** Names already in the athlete's library, so the model reuses them. */
	libraryExercises: string[];
	/** Session names already in the library, so routines can target them. */
	librarySessions?: string[];
	today?: IsoDate;
}

/** Long lists stop helping and start eating the model's attention. */
const MAX_LIBRARY_NAMES = 150;

export function buildCoachPrompt(brief: CoachBrief, context: PromptContext): string {
	const today = context.today ?? todayIso();
	const library = context.libraryExercises.slice(0, MAX_LIBRARY_NAMES);
	const truncated = context.libraryExercises.length - library.length;

	const request = [
		bullet('Goal', brief.goal),
		bullet('Sport / discipline', brief.discipline),
		bullet('Level', brief.level && LEVEL_TEXT[brief.level]),
		bullet('How many sessions to design', brief.sessionCount?.toString()),
		bullet(
			'Target length per session',
			brief.minutesPerSession === null ? null : `about ${brief.minutesPerSession} minutes`
		),
		bullet('Training days per week', brief.daysPerWeek?.toString()),
		bullet('Equipment available', brief.equipment),
		bullet('Constraints, injuries, things to work around', brief.constraints),
		bullet('Must include these exercises', brief.mustInclude?.join(', ')),
		bullet('Must avoid', brief.avoid?.join(', ')),
		bullet('Set style', brief.measurePreference && MEASURE_TEXT[brief.measurePreference]),
		bullet('Anything else', brief.notes)
	]
		.filter((line): line is string => line !== null)
		.join('\n');

	const policy = brief.exercisePolicy ? `\n\n${POLICY_TEXT[brief.exercisePolicy]}` : '';

	const librarySection =
		library.length > 0
			? `## The athlete's existing exercise library

These already exist. Refer to any of them by the exact name below and do NOT
redefine them in \`exercises\` — reusing a name keeps their training history
connected.

${library.map((name) => `- ${name}`).join('\n')}${truncated > 0 ? `\n- …and ${truncated} more` : ''}${policy}`
			: `## The athlete's existing exercise library

The library is empty, so define every exercise you use in the \`exercises\`
array.`;

	const librarySessions = context.librarySessions ?? [];
	/** Only a schedule can target them, so the list is noise without one. */
	const sessionsSection =
		brief.includeRoutines && librarySessions.length > 0
			? `\n\nExisting sessions a routine may target: ${librarySessions.map((n) => `"${n}"`).join(', ')}.`
			: '';

	/**
	 * Three shapes of ask, and the brief decides which. Sessions are only
	 * designed when the athlete set one of the session options; a schedule
	 * without them can only target sessions they already have, and with neither
	 * the pack is the exercises themselves.
	 */
	const designSessions = wantsSessions(brief);
	const scheduleOnly = !designSessions && brief.includeRoutines && librarySessions.length > 0;
	const perWeek =
		brief.daysPerWeek === null
			? ''
			: ` (${brief.daysPerWeek} training day${brief.daysPerWeek === 1 ? '' : 's'} per week)`;

	const tasks: string[] = [];

	if (designSessions) {
		tasks.push(
			brief.sessionCount === null
				? 'Design the sessions the request above needs — you decide how many.'
				: `Design ${brief.sessionCount} session${brief.sessionCount === 1 ? '' : 's'} that meet the request above.`
		);
		if (brief.minutesPerSession !== null) {
			tasks.push(
				`Each session should come out at roughly ${brief.minutesPerSession} minutes, counting work and rest.`
			);
		}
		tasks.push(
			brief.includeRoutines
				? `Also produce \`routines\` that schedule these sessions across a typical week${perWeek}, starting ${today}.`
				: 'Leave `routines` as an empty array — the athlete will schedule these themselves.'
		);
	} else if (scheduleOnly) {
		tasks.push(
			'Do NOT design any new sessions — leave `sessions` as an empty array. Only the schedule was asked for.'
		);
		tasks.push(
			`Produce \`routines\` that schedule the athlete's existing sessions listed above${perWeek}, starting ${today}. Name each one exactly as it appears there.`
		);
	} else {
		tasks.push(
			`Do NOT design sessions or routines — leave both arrays empty${brief.includeRoutines ? ', and note in `summary` that there are no saved sessions to schedule yet' : ''}. What was asked for is the exercises themselves: define every movement the request above calls for in \`exercises\`, each with full \`instructions\`.`
		);
	}

	tasks.push('Return the result as one JSON object in the format below.');

	const opening = designSessions
		? `Design a training
programme for the athlete below, then return it as a single JSON file in the
exact format specified further down.`
		: scheduleOnly
			? `Plan the training
week for the athlete below out of the sessions they already have, then return
it as a single JSON file in the exact format specified further down.`
			: `Write up the
exercises the athlete below is asking for, then return them as a single JSON
file in the exact format specified further down.`;

	return `You are an experienced strength and conditioning coach. ${opening}

## What the athlete asked for

${request || '- (no details given — use your judgement)'}

${librarySection}${sessionsSection}

## Your task

${tasks.map((task, index) => `${index + 1}. ${task}`).join('\n')}

${formatSpec()}

## How to reply

Reply with **exactly one \`\`\`json fenced code block containing the pack, and
nothing else** — no commentary before or after it. Put any explanation you want
to give inside the \`summary\` field. Today's date is ${today}.`;
}

/**
 * A skill file for the athlete's own agent. Same rules as the prompt, minus the
 * one-off brief — an agent that has read this can be asked for a session at any
 * time in plain language.
 */
export function buildSkillFile(): string {
	return `---
name: cerebro-sport-session-author
description: Write training sessions, exercises and schedules as a Cerebro Sport training pack (JSON) that can be imported directly into the Cerebro Sport training app. Use whenever the user asks for a workout, a training session, a training programme or a weekly training plan that they want to import, or mentions a "training pack".
---

# Cerebro Sport session author

Design training and emit it as a **training pack** — a single JSON object the
Cerebro Sport training app imports directly.

## When to use this

Trigger on any request to build a workout, session, circuit, training programme
or weekly plan intended for the Cerebro Sport app. If the user just wants advice or
a discussion about training, answer normally; only produce a pack when they want
something importable.

## How to work

1. **Ask before designing** if anything essential is missing: the goal, the sport,
   how long a session should be, what equipment is available, how many days a
   week, and any injuries to work around. One short round of questions, not an
   interrogation.
2. **Ask which exercises already exist** in their library, if they have not said.
   Reusing an existing name keeps their history connected; inventing a duplicate
   under a slightly different name splits it.
3. **Design the sessions**, then express them in the format below.
4. **Emit exactly one \`\`\`json fenced block** containing the pack, with no
   commentary outside it. Anything you want to say goes in \`summary\`.

If the user reports validation errors from the importer, fix precisely those
paths and re-emit the whole corrected pack.

${formatSpec()}

## Quality bar

- \`instructions\` is read on a phone, mid-set, by someone out of breath. Setup,
  execution, one or two form cues. No essays.
- Prefer a smaller number of well-chosen movements repeated across a programme
  over a different exercise every session — progress is only measurable when the
  same step recurs.
- Rest values should be deliberate. Strength work wants 90-180s between rounds;
  conditioning circuits want 15-60s.
- Sanity-check the arithmetic: rounds x (work + rest) should land near the
  session length the athlete asked for.
`;
}
