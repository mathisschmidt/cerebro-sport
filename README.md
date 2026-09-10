# Van Damme — training log

A sport-agnostic training app: build a library of exercises, compose them into
sessions, put those sessions on a repeating schedule, run them with a timer, and
watch whether you are getting faster.

Nothing in the domain assumes a particular sport. An exercise is "a thing you
repeat"; a set is "a number plus the unit it is counted in". Pull-ups, 400m
repeats and free-kick drills are all the same shape.

Built for the desktop when you are planning, and for a phone when you are on the
floor between rounds.

---

## Quick start

Requires **Node 22+** (developed on 24 LTS).

```bash
npm install
npm run db:seed      # creates ./data/app.db, migrates it, fills it with a demo library
npm run dev          # http://localhost:5173
```

`npm run db:seed` is optional — the app creates and migrates an empty database on
first start. The seed adds twelve exercises, three sessions, three routines and
six weeks of history so the metrics pages have something to show.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` / `npm start` | Production build (adapter-node) and run it |
| `npm run check` | `svelte-check` over the whole project — types and template bindings |
| `npm run db:generate` | Regenerate SQL migrations after editing the schema |
| `npm run db:migrate` | Apply migrations and list the resulting tables |
| `npm run db:seed` | Populate an empty database with demo data |
| `npm run db:reset` | Delete the database file |
| `npm run db:studio` | Drizzle Studio, a browser UI over the tables |

Configuration is one variable, in `.env`:

```
DATABASE_URL=./data/app.db
```

---

## The four pages

- **Today** (`/`) — routines due today, ticked off or started from here; streak,
  adherence and a training calendar; what is coming later this week.
- **Library** (`/library`) — three tabs: sessions, exercises, routines.
- **Metrics** (`/metrics`) — overall volume and consistency, then a per-session
  breakdown down to the pace of each individual step.
- **Runner** (`/run/[id]`) — full-screen, one-handed. Countdown for timed work, a
  big *Done* button for reps, audio and haptic cues, a screen wake lock, and
  keyboard shortcuts on desktop (`space`, `←`, `→`).

---

## Architecture

Four layers, each depending only on the one beneath it:

```
routes/            SvelteKit pages and /api endpoints — no business logic
  └── services/    business rules, orchestration, invariants
        └── repositories/   queries, returning domain models (never rows)
              └── db/       Drizzle schema, connection, row↔model mappers

lib/domain/        models + pure logic — depends on nothing above it
```

### `lib/domain` — the centre of gravity

Everything the app persists or transports is defined **once**, as a zod schema,
in `lib/domain/models`. The database schema, the HTTP validation, the API client
types and the forms all derive from those. Adding a field to an exercise is one
edit in `models/exercise.ts`, one column, one mapper line — not a hunt through
six files with their own idea of what an exercise is.

The rule that keeps this honest: **zod for anything written or received; plain
TypeScript types for derived read models.** Entities and inputs get schemas;
metrics — which are computed, never submitted — are interfaces.

`lib/domain/services` holds pure functions with no I/O: recurrence expansion,
plan flattening, metric calculations, calendar arithmetic. They run identically
on the server and in the browser, which is what lets the session editor preview a
plan with the very same code the runner will execute.

### The three model decisions worth knowing

**A session is blocks → rounds → items.** A block is a circuit repeated `rounds`
times over an ordered list of items; an item is one exercise plus a measure.
"5 rounds of (10 jumping jacks + 5 push-ups), 30s rest, then 2 rounds of
(5 push-ups + 5 sit-ups)" is exactly two blocks. Rest belongs to the thing you
rest *after* rather than being a node of its own, which keeps the tree shallow
and the editor simple.

**The plan is derived, not stored.** `buildPlan()` flattens a session into a
linear list of steps with rest materialised. The editor preview, the duration
estimate, the runner and the metrics all consume that one function, so they
cannot drift apart. Every step carries a `key` that is stable across executions
— that key is what makes "am I faster on round 4 of push-ups?" answerable.

**Occurrences are computed; only deviations are stored.** A routine holds a rule,
not a list of dates. `routine_occurrences` gets a row only when something is
completed or skipped, so an open-ended schedule stays finite. A recorded
occurrence that the current rule no longer generates — because the routine was
paused or edited — is still surfaced, so past adherence never rewrites itself.

### Why workouts snapshot their plan

A `workout` stores a frozen copy of the plan it ran and has **no foreign key to
the session**. Edit a session and last month's numbers still describe what you
actually did; delete one and the history survives. `totalMs` is the sum of
measured step durations rather than wall-clock time, so a phone left locked
mid-session cannot report an hour of "training".

### Swapping SQLite out

`lib/server/db/client.ts` is the only file that names `better-sqlite3`.
Repositories talk to the Drizzle instance, services talk to repositories, routes
talk to services. Moving to Postgres means replacing that file and the dialect
import in `schema.ts` — the layers above are untouched.

### The HTTP contract

Every endpoint goes through `endpoint()` in `lib/server/http/respond.ts`:
validate with a zod schema, return a value, let thrown `AppError`s become the
response. Handlers never build a `Response` by hand. Validation failures come
back as `{ error: { code, message, details } }` where `details` maps field paths
to messages — the typed client turns those straight into form errors.

```
422 { "error": { "code": "validation_failed", "message": "Some fields are invalid",
                 "details": { "blocks.0.items.1.measure.value": "Too small" } } }
```

### Design system

Tokens live in `src/app.css` as CSS custom properties, mapped into Tailwind
utilities with `@theme inline` so `bg-surface` follows the theme instead of
baking in a colour. Light and dark are both first-class; the theme is applied
before first paint by an inline script, so it never flashes.

Chart colours are not hand-picked: the sequential ramp and the series colour were
validated per theme for monotone lightness, visible step gaps and contrast
against their own surface. Status colours (faster / slower) always ship with an
arrow and a word, never colour alone.

---

## Project layout

```
src/
  app.css                     design tokens, base layer, viz palette
  lib/
    domain/
      models/                 zod schemas + types — the single source of truth
      services/               pure logic: recurrence, plan, metrics, dates, scales
    server/
      db/                     drizzle schema, connection, mappers, ids
      repositories/           data access, returns domain models
      services/               business rules
      http/                   endpoint wrapper, errors, param helpers
    client/                   typed API client, runner state machine, stores
    components/
      ui/                     primitives (button, modal, field, stat…)
      charts/                 line, bar, sparkline, heatmap, trend pill
      exercises/ sessions/ routines/ runner/ metrics/ shared/
  routes/
    +page.svelte              Today
    library/                  sessions · exercises · routines
    metrics/
    run/[id]/                 the workout runner
    api/                      JSON endpoints
drizzle/                      generated SQL migrations
scripts/                      migrate · seed · reset (+ alias hooks for plain node)
```

## Deployment

`npm run build` produces a standalone Node server via `adapter-node`:

```bash
npm run build
DATABASE_URL=/var/lib/vandamme/app.db PORT=3000 node build/index.js
```

The SQLite file and its `-wal`/`-shm` siblings are the entire state — back up the
directory and you have backed up everything.
