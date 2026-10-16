# Cerebro Sport — training log

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
| `npm run skill:write` | Regenerate `skills/cerebro-sport-session-author/SKILL.md` from the format spec |

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

**First run** creates an admin: `admin` / `admin123`. Change the password from
the Account page, or set `ADMIN_USERNAME` and `ADMIN_PASSWORD` before the first
boot. If the database already held training data, that data is adopted by this
account.

Sign-in is by username, so the synthesised email address is never typed and
never used.

**Registration is closed by default.** A fresh instance is not open to whoever
finds it. An admin can open it from the Admin page, and while it is closed only
an admin can add accounts. Sign-in is by username — no mail is configured, so
the address Better Auth requires is synthesised from the username.

**Roles** are `admin` and athlete. Admins additionally get the Admin page: open
or close registration, add accounts, change roles, and delete accounts. Deleting
an account permanently deletes everything it owned. An admin cannot delete their
own account or drop their own admin role, so an instance cannot be locked out.

Everyone can change their own username and password from the **Account** page.
Renaming keeps everything — data and sessions belong to the account, not the
name. A password change asks for the current one, and can sign out every other
device at the same time. There is no "forgot password" flow, because no mail is
configured.

Auth, sessions and roles are handled by [Better Auth](https://better-auth.com)
with its username and admin plugins, on the same SQLite database through the
Drizzle adapter.

## The pages

- **Today** (`/`) — what is on the plan today (routine and session), ticked off
  or started from here; streak, last 7 days and today's tally; the training
  calendar; the sessions coming later this week; recent sessions with how each
  one went.
- **Library** (`/library`) — three tabs: sessions, exercises, routines.
- **Coach** (`/coach`) — describe what you want, get a prompt to paste into any
  AI chat, paste the answer back to import it. See below.
- **Metrics** (`/metrics`) — overall volume and consistency, then each session's
  progress in total time, with its run history.
- **Account** (`/account`) — change your username or password.
- **Admin** (`/admin`, admins only) — registration, accounts and roles.
- **Runner** (`/run/[id]`) — full-screen, one-handed. Countdown for timed work, a
  big *Done* button for reps, audio and haptic cues, a screen wake lock, and
  keyboard shortcuts on desktop (`space`, `←`, `→`). The speaker button sets the
  volume of the countdown beeps and step tones, saved per device. Leaving asks
  whether to save or discard the run — see below.

### How runs are measured

One rule set, used by every screen that shows a run:

- **Total time is training time**: every step's time summed, rests included,
  **pauses excluded**. Pausing means you stopped training — something urgent,
  not part of the session — so the clock stops and none of it counts. It is the
  only time the metrics use.
- **A run is never resumed.** Leaving ends it, however it happens. The leave
  button asks to **save** (kept, with its outcome) or **discard** (deleted); a
  closed tab or a reload saves what was done; starting another session ends the
  one still open. A run left with no step done is simply deleted.
- **Every run gets an outcome** from the share of its steps not done (skipped,
  or never reached):

  | Outcome | Steps missed | Colour |
  | --- | --- | --- |
  | Completed | none | green |
  | Not finished | up to 30% | green |
  | Skipped a few | more than 30% | yellow |
  | Ended early | more than 50% | red |

- **A session's stats — last, best, average, trend and the progress chart —
  use completed runs only.** Any missed step makes a run "faster", so it would
  make progress meaningless. Every run still appears in the session's history
  with its outcome, and counts in the overall volume and the calendar.
- **The training calendar has three states**: green when you trained (planned
  or not), red when something was due and nothing was done, and the empty cell
  when nothing was planned and nothing done. Today is never red while it is
  still running.
- A scheduled routine is ticked off only by a completed run.
- **Editing what a session runs offers to reset its history.** When the blocks,
  exercises, measures or rests change and the session already has runs, saving
  asks whether to keep them or start over. Renaming or rewording never asks.
  A reset deletes the session's runs but keeps routine ticks, so streaks and the
  calendar's planned days stay as they were.

### Training offline

A gym basement or a park with no signal should not stop a session. The app is
installable (Share → *Add to Home Screen* on iPhone, *Install app* on Android)
and works without a connection:

- **Training works fully offline.** Start a session from Today, the "Free
  session" picker or a session's page; run it, pause it, save or discard it.
  Timers, sounds and the wake lock are all on the phone.
- **Everything else is read-only offline.** Today, the library and the metrics
  show what was last saved on the device, with a banner saying so. Changing
  anything needs a connection. A page never opened online on that device says
  it is not available offline yet.
- **Today's plan stays right on a new day.** The phone keeps the routines'
  rules and works the day out itself, so a page saved yesterday still shows
  today's plan.
- **Runs sync on their own** once the connection is back — on opening the app,
  on reconnecting, or when the app comes back to the front. A chip in the header
  says how many runs are waiting; Recent sessions marks them *waiting to sync*.
  A scheduled routine run offline shows as done straight away.

How it works: **runs are local-first.** Every run, online or not, is created on
the phone and stored there (IndexedDB), and each start, step and finish is
queued in an *outbox* that delivers to the server in order. Online, the queue
empties at once; offline, it waits. The server endpoints are idempotent — the
phone sends its own workout id, start time and plan — so a delivery retried
after a dropped connection never duplicates anything. While online, the app
keeps a *snapshot* (`GET /api/offline/snapshot`): every session's plan, the
routines and recent completions — what is needed to start a run and rebuild the
day. A service worker keeps the app's code and the last copy of each page.

All the run rules hold offline: a run is never resumed, pauses do not count,
outcomes are the same, and starting a run ends the one still open.

Things to know:

- **Offline needs HTTPS.** Browsers only allow service workers on HTTPS (or
  `localhost`). Behind a TLS proxy that is already the case; on a plain-HTTP
  LAN address the app works, just not offline.
- **iOS may clear a web app's storage** after about a week of not opening it.
  Runs not yet synced would go with it — the header chip is there so you notice
  them waiting.
- **Signing out wipes the device**: queued runs, the snapshot and every saved
  page, so the next person cannot read anything offline. If runs are still
  waiting, sign-out asks first.
- **A new version never interrupts a run.** It waits, and a banner offers to
  reload once you are back on a normal page.

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
  "format": "cerebro-sport.training-pack",
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

`skills/cerebro-sport-session-author/SKILL.md` is the same rules packaged as an
agent skill: drop it into Claude Code, an agent framework or a custom GPT and
you can ask for a session in plain language, with no prompt to copy each time.
The Coach page offers the same file as a download.

It is **generated** from `formatSpec()` in `coach-prompt.ts` — the single source
the on-page prompt also uses. After changing the format, run `npm run skill:write`.

---

## Deploying

One container, two volumes. The app applies its own migrations and creates its
own first admin at boot, so there is no setup step.

It serves **plain HTTP**. If you are putting it on the internet, run a reverse
proxy in front of it and terminate TLS there — nginx, Traefik, Caddy, a tunnel,
whatever you already use. On a home network you can skip that and reach it
directly.

### Portainer

Deploy as a stack **from the Git repository** — not by pasting the compose file
into the web editor. A pasted stack has no source tree, and this compose file
builds the image from the Dockerfile.

1. **Stacks → Add stack → Repository**
2. Repository URL: this repo. Compose path: `docker-compose.yml`
3. Under **Environment variables**, add `BETTER_AUTH_SECRET` and `ORIGIN`
   (and `ADMIN_USERNAME` / `ADMIN_PASSWORD` if you want something other than
   `admin` / `admin123`)
4. Deploy

Redeploying after a push: **Pull and redeploy** on the stack. Portainer rebuilds
the image and recreates the container; the volumes are untouched.

If you would rather not build on the server, build and push the image somewhere
and replace the `build:` block with your registry tag.

### Plain compose

```bash
cp .env.production.example .env
$EDITOR .env                     # BETTER_AUTH_SECRET and ORIGIN are required
docker compose up -d --build
```

### What has to be set

| Variable | Why |
|---|---|
| `BETTER_AUTH_SECRET` | Signs session cookies. `openssl rand -base64 32`. The app refuses to serve in production without it; changing it signs everyone out. |
| `ORIGIN` | The public URL, no trailing slash. SvelteKit builds absolute URLs from it and cannot infer it behind a proxy. On a LAN, the address you actually type on the phone: `http://192.168.1.20:3000`. Use the `https://` address when there is one — offline training needs it. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | The account created on first boot only. Change the password from the Account page after signing in. |
| `BIND_ADDRESS` | Optional. Defaults to every interface. Set `127.0.0.1` if a reverse proxy on the same host should be the only thing that can reach it. |

Both compose and Portainer refuse to start the stack if `BETTER_AUTH_SECRET` or
`ORIGIN` is missing, and the error names the variable.

### Backups

The database is a single SQLite file on the `cerebro-sport-data` volume. Losing
it loses everything; nothing else in the deployment holds state.

```bash
docker compose exec app node scripts/backup.mjs /backups
```

In Portainer that is **Containers → cerebro-sport → Console**, then the same
command. It uses `VACUUM INTO`, which is safe against a running app — unlike
copying the file, which can catch a half-written page or miss the write-ahead
log. The last 14 snapshots are kept on the `cerebro-sport-backups` volume.

Nothing runs this for you. Put it in cron on the host if you want it nightly:

```bash
0 3 * * * docker compose -f /path/to/docker-compose.yml exec -T app node scripts/backup.mjs /backups
```

To copy a snapshot off the volume, or restore one:

```bash
docker cp cerebro-sport-app-1:/backups/app-<timestamp>.db ./          # off
docker compose down                                                    # restore
docker run --rm -v cerebro-sport-data:/data -v "$PWD:/in" \
  alpine cp /in/app-<timestamp>.db /data/app.db
docker compose up -d
```

### Notes

- **One replica, always.** SQLite is a single writer against a single file; a
  second container against the same volume would corrupt it.
- **Migrations run at boot**, from `db/client.ts`. A deploy that adds one needs
  no extra command — but for the same reason, do not start two containers at
  once against a fresh volume.
- `GET /api/health` is public and checks that the database answers. It is what
  the container health check probes, and what Portainer shows as healthy.
- The image runs as the unprivileged `node` user and carries no source, no dev
  dependencies and no build toolchain.

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
estimate and the runner both consume that one function, so they cannot drift
apart. Every step carries a `key` that is stable across executions, and every
step log stores it, so a per-step history can always be rebuilt from the logs.

**Occurrences are computed; only deviations are stored.** A routine holds a rule,
not a list of dates. `routine_occurrences` gets a row only when something is
completed or skipped, so an open-ended schedule stays finite. A recorded
occurrence that the current rule no longer generates — because the routine was
paused or edited — is still surfaced, so past adherence never rewrites itself.

### Why workouts snapshot their plan

A `workout` stores a frozen copy of the plan it ran and has **no foreign key to
the session**. Edit a session and last month's numbers still describe what you
actually did; delete one and the history survives. `totalMs` is derived from
the step logs — each step's time with pauses taken out, measured on the phone —
so it is never a difference against the server's clock, and because a run
cannot be resumed, a phone left on the bench overnight cannot stretch one.

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

Chart colours are not hand-picked: the series colour and the good / critical pair
were validated per theme with the dataviz skill's script — contrast against
their own surface, and colour-blind separation for the green/red pair the
training calendar relies on. Status colours (faster / slower, run outcomes)
always ship with an arrow or a word, never colour alone.

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
      offline/                local runs, outbox, snapshot, connectivity, updates
    components/
      ui/                     primitives (button, modal, field, stat…)
      charts/                 line, bar, training calendar, trend pill
      exercises/ sessions/ routines/ runner/ metrics/ coach/ shared/
  service-worker.ts           app shell + last copy of each page, for offline
  routes/
    +page.svelte              Today
    login/ register/          sign-in, and sign-up when it is open
    admin/                    accounts, roles, registration
    library/                  sessions · exercises · routines
    coach/                    prompt builder + pack importer
    metrics/
    run/[id]/                 the workout runner (browser-only: runs live on the phone)
    api/                      JSON endpoints
Dockerfile                    multi-stage build; runtime carries no sources
docker-compose.yml            the deployment: one service, two volumes
drizzle/                      generated SQL migrations
skills/                       the agent skill file, generated from the format spec
scripts/                      migrate · seed · reset · write-skill (+ alias hooks)
  backup.mjs                  VACUUM INTO snapshot; runs inside the image too
```

## Running without Docker

`npm run build` produces a standalone Node server via `adapter-node`. See
[Deploying](#deploying) for the container route, which is the supported one.

```bash
npm run build
BETTER_AUTH_SECRET=$(openssl rand -base64 32) \
ORIGIN=https://training.example.com \
DATABASE_URL=/var/lib/cerebrosport/app.db \
PORT=3000 node build/index.js
```

The `drizzle/` folder must sit beside the process's working directory —
migrations are read from it at boot.
