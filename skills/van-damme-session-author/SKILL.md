---
name: van-damme-session-author
description: Write training sessions, exercises and schedules as a Van Damme training pack (JSON) that can be imported directly into the Van Damme training app. Use whenever the user asks for a workout, a training session, a training programme or a weekly training plan that they want to import, or mentions a "training pack".
---

# Van Damme session author

Design training and emit it as a **training pack** — a single JSON object the
Van Damme training app imports directly.

## When to use this

Trigger on any request to build a workout, session, circuit, training programme
or weekly plan intended for the Van Damme app. If the user just wants advice or
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
4. **Emit exactly one ```json fenced block** containing the pack, with no
   commentary outside it. Anything you want to say goes in `summary`.

If the user reports validation errors from the importer, fix precisely those
paths and re-emit the whole corrected pack.

## Output format

Return a single JSON object — the "training pack".

```
{
  "format": "van-damme.training-pack",
  "version": 1,
  "summary": string,            // one or two sentences about what you built, and any caveat
  "exercises": Exercise[],      // every NEW movement the sessions use
  "sessions": Session[],        // the workouts themselves
  "routines": Routine[]         // optional schedule; omit or leave [] if not asked for
}
```

### Exercise

```
{
  "name": string,               // 1-80 chars, unique, the key sessions refer to
  "description": string,        // what the movement IS, one or two sentences
  "instructions": string,       // HOW to perform it: setup, execution, form cues.
                                // This is displayed on the phone mid-set, so make it useful.
  "category": strength | cardio | mobility | skill | endurance | other,
  "tags": string[],             // 0-12 short tags, e.g. ["upper body", "no equipment"]
  "defaultMeasure": Measure | null
}
```

### Measure — how a set is counted

```
{ "type": "reps",     "value": integer }   // repetitions, 1-10000
{ "type": "time",     "value": integer }   // SECONDS, 1-86400
{ "type": "distance", "value": number  }   // METRES, 1-1000000
```

Allowed types: reps | time | distance. `time` runs a countdown in the app; `reps` and
`distance` wait for the athlete to tap "done".

### Session

```
{
  "name": string,               // 1-80 chars, unique within the pack
  "description": string,        // 0-2000 chars
  "blocks": Block[]             // at least one
}
```

### Block — one circuit, repeated

```
{
  "label": string,              // 0-80 chars, e.g. "Warm-up", "Main circuit", "Finisher"
  "rounds": integer,            // 1-100, how many times the whole item list repeats
  "restBetweenRoundsSec": integer,  // 0-3600, rest after each round except the last
  "restAfterSec": integer,      // 0-3600, rest after the block; ignored on the last block
  "items": Item[]               // at least one
}
```

### Item — one exercise inside a block

```
{
  "exercise": string,           // EXACT name of an exercise, matched case-insensitively
  "measure": Measure,
  "restAfterSec": integer,      // 0-3600, rest before the next item in the same round
  "targetLoad": string,         // 0-40 chars, free text: "20 kg", "red band", "bodyweight"
  "notes": string               // 0-500 chars, a cue shown during the set
}
```

### Routine — a session on repeat

```
{
  "name": string,               // 0-80 chars; defaults to the session name if empty
  "session": string,            // name of a session in this pack, or one already in the library
  "recurrence": Recurrence,
  "startDate": "YYYY-MM-DD",    // optional, defaults to the day of import
  "endDate": "YYYY-MM-DD" | null,
  "timeOfDay": "HH:MM" | null   // informative ordering only, it does not notify
}
```

```
{ "type": "once" }
{ "type": "daily",   "interval": integer }                          // every N days
{ "type": "weekly",  "interval": integer, "weekdays": string[] }    // sun | mon | tue | wed | thu | fri | sat
{ "type": "monthly", "interval": integer, "dayOfMonth": integer }   // 1-31
```

## The rules that matter

1. **Every `item.exercise` must name an exercise** that is either in the
   existing library or defined in this pack's `exercises` array. Spell it
   identically in both places.
2. **Rest belongs to the thing you rest after.** Rest between two items in the
   same round is that item's `restAfterSec`. Rest between rounds is the
   block's `restBetweenRoundsSec`. Rest between blocks is the block's
   `restAfterSec`. Never create a separate "rest exercise".
3. **A block is a circuit, not a single set.** "4 sets of 6 pull-ups with 90s
   rest" is ONE block with `rounds: 4` and `restBetweenRoundsSec: 90` — not
   four blocks.
4. Warm-up, main work and cool-down are usually separate blocks with
   `rounds: 1` unless they genuinely repeat.
5. All durations are **integer seconds**. All distances are **metres**. Never
   write "30s", "1:30" or "2 min" — write `30`, `90`, `120`.
6. Session names must be unique within the pack.
7. Write `instructions` for every new exercise as if the reader has never done
   it. That text is what the athlete reads mid-set.

## Worked example

"5 rounds of (10 jumping jacks + 5 push-ups) with 30s rest between rounds, then
2 rounds of (5 push-ups + 5 sit-ups)" is exactly two blocks:

```json
{
  "format": "van-damme.training-pack",
  "version": 1,
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
```

## Quality bar

- `instructions` is read on a phone, mid-set, by someone out of breath. Setup,
  execution, one or two form cues. No essays.
- Prefer a smaller number of well-chosen movements repeated across a programme
  over a different exercise every session — progress is only measurable when the
  same step recurs.
- Rest values should be deliberate. Strength work wants 90-180s between rounds;
  conditioning circuits want 15-60s.
- Sanity-check the arithmetic: rounds x (work + rest) should land near the
  session length the athlete asked for.
