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
| `npm run skill:write` | Regenerate `skills/van-damme-session-author/SKILL.md` from the format spec |

Set `BETTER_AUTH_SECRET` before deploying anywhere real — it signs session
cookies, and there is a development fallback that must not be used in
production. `ADMIN_USERNAME` and `ADMIN_PASSWORD` override the first-run admin.

Configuration is one variable, in `.env`:

```
DATABASE_URL=./data/app.db
```

---

## Accounts

Everything is private by default. A route has to be listed as public in
`hooks.server.ts` to be reachable signed out, and every training row belongs to
exactly one account — one athlete's library, sessions, routines and history are
invisible to everyone else, including other admins.

**First run** creates an admin: `admin` / `admin123`. Change the password, or
set `ADMIN_USERNAME` and `ADMIN_PASSWORD` before the first boot. If the database
already held training data, that data is adopted by this account.

**Registration is closed by default.** A fresh instance is not open to whoever
finds it. An admin can open it from the Admin page, and while it is closed only
an admin can add accounts. Sign-in is by username — no mail is configured, so
the address Better Auth requires is synthesised from the username.

**Roles** are `admin` and athlete. Admins additionally get the Admin page: open
or close registration, add accounts, change roles, and delete accounts. Deleting
an account permanently deletes everything it owned. An admin cannot delete their
own account or drop their own admin role, so an instance cannot be locked out.

Auth, sessions and roles are handled by [Better Auth](https://better-auth.com)
with its username and admin plugins, on the same SQLite database through the
Drizzle adapter.

## The pages

- **Today** (`/`) — routines due today, ticked off or started from here; streak,
  adherence and a training calendar; what is coming later this week.
- **Library** (`/library`) — three tabs: sessions, exercises, routines.
- **Coach** (`/coach`) — describe what you want, get a prompt to paste into any
  AI chat, paste the answer back to import it. See below.
- **Metrics** (`/metrics`) — overall volume and consistency, then a per-session
  breakdown down to the pace of each individual step.
- **Admin** (`/admin`, admins only) — registration, accounts and roles.
- **Runner** (`/run/[id]`) — full-screen, one-handed. Countdown for timed work, a
  big *Done* button for reps, audio and haptic cues, a screen wake lock, and
  keyboard shortcuts on desktop (`space`, `←`, `→`).

---

## The Coach page

Building a programme by hand is slow. The Coach page has two ways in, chosen
with the toggle at the top and remembered in the URL (`/coach?mode=import`).

**Ask an AI** — for when you want the prompt written for you:

1. **Describe what you want.** Goal, sport, level, session length, equipment,
   injuries, which of your exercises to include or avoid, and whether the model
   may invent new movements or must stick to your library.
2. **Copy the generated prompt** into ChatGPT, Claude, Gemini — anything. The
   prompt carries your brief, the names already in your library, the complete
   file format and a worked example.
3. **Bring the answer back**, as a file or a paste.

**I have a file** — for when your own agent or script already produced a pack.
Straight to the importer: drop a `.json` file on it, pick one, or paste. Nothing
else in the way.

Either way the pack is parsed, validated and **previewed** — what will be
created, what will be reused from your library, what got renamed — before
anything is written. Whatever is in the box survives switching between the two
modes.

The paste box is deliberately forgiving about the envelope and strict about the
contents: markdown fences, surrounding prose and trailing commas are all
tolerated, weekday names are accepted in place of numbers, and a missing
`startDate` defaults to today. When something genuinely does not validate, the
errors come back with exact paths and a **Copy these errors for the AI** button —
paste that back into the same chat and it corrects itself.

### The training pack format

The interchange format is **JSON**, not YAML: it needs no parser dependency,
maps 1:1 onto the existing zod schemas, and has no indentation failure mode —
which matters when a model writes the file and a clipboard carries it.

```jsonc
{
  "format": "van-damme.training-pack",
  "version": 1,
  "summary": "…",
  "exercises": [ /* new movements, with instructions */ ],
  "sessions":  [ /* name, description, blocks[] → items[] */ ],
  "routines":  [ /* optional schedule */ ]
}
```

Items reference exercises **by name**, not by id — that is what makes the format
writable by something with no access to this database. On import, names are
matched case-insensitively against the library, missing ones are created from
the `exercises` array, and a session whose name is already taken is saved with a
numeric suffix rather than overwriting anything.

Every shape in `models/pack.ts` is the corresponding domain input schema with
one field swapped, so all the real rules — lengths, ranges, defaults — are
inherited rather than restated. The format cannot drift from what the app
accepts.

### Bring your own agent

`skills/van-damme-session-author/SKILL.md` is the same rules packaged as an
agent skill: drop it into Claude Code, an agent framework or a custom GPT and
you can ask for a session in plain language, with no prompt to copy each time.
The Coach page offers the same file as a download.

It is **generated** from `formatSpec()` in `coach-prompt.ts` — the single source
the on-page prompt also uses. After changing the format, run `npm run skill:write`.

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
      services/               pure logic: recurrence, plan, metrics, dates, scales,
                              pack parsing/resolution, coach prompt
    server/
      db/                     drizzle schema, connection, mappers, ids
      repositories/           data access, returns domain models
      services/               business rules
      http/                   endpoint wrapper, errors, param helpers
    client/                   typed API client, runner state machine, stores
    components/
      ui/                     primitives (button, modal, field, stat…)
      charts/                 line, bar, sparkline, heatmap, trend pill
      exercises/ sessions/ routines/ runner/ metrics/ coach/ shared/
  routes/
    +page.svelte              Today
    login/ register/          sign-in, and sign-up when it is open
    admin/                    accounts, roles, registration
    library/                  sessions · exercises · routines
    coach/                    prompt builder + pack importer
    metrics/
    run/[id]/                 the workout runner
    api/                      JSON endpoints
drizzle/                      generated SQL migrations
skills/                       the agent skill file, generated from the format spec
scripts/                      migrate · seed · reset · write-skill (+ alias hooks)
```

## Deployment

`npm run build` produces a standalone Node server via `adapter-node`:

```bash
npm run build
DATABASE_URL=/var/lib/vandamme/app.db PORT=3000 node build/index.js
```

The SQLite file and its `-wal`/`-shm` siblings are the entire state — back up the
directory and you have backed up everything.
