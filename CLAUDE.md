# Working in this repo

Read `README.md` first — it explains the layering and the three model decisions
(session shape, derived plan, computed occurrences). This file is the short list
of rules to keep to when changing things.

## The one rule

**Extend the existing model; do not add a parallel one.** If a new feature needs
data that is nearly an exercise, a session item or a measure, widen that model.
The point of this codebase is that there is exactly one definition of each
concept and everything else derives from it.

## Layer discipline

```
routes → services → repositories → db
lib/domain is imported by everything and imports nothing above it
```

**Every owned table is scoped by `userId`, and that is threaded explicitly.**
Repository and service methods take the owner as their first argument — there is
no ambient "current user". Build every `where` on an owned table with `ownedBy`
(`repositories/scope.ts`) so an unscoped query is visible at a glance. The owned
tables are `exercises`, `sessions`, `routines` and `workouts`; their children
(`session_blocks`, `session_items`, `routine_occurrences`, `workout_steps`) are
only ever reached through an already-scoped parent.

Endpoints use `authed()` / `adminOnly()` from `http/respond.ts`, which hand the
handler a `SessionUser`; page loads use `requireUser` / `requireAdmin` from
`http/session.ts`. Do not read `locals.user` directly and hope it is there.

- Routes contain no business logic. They validate, call one service, return.
- Services own invariants and throw `AppError` (`$server/http/errors.ts`).
  They never import from `@sveltejs/kit` — that is what keeps them testable and
  callable from `scripts/`.
- Repositories return domain models, never rows. Row↔model translation lives in
  `db/mappers.ts`, so nothing above it knows that a measure is two columns or
  that tags are a JSON string.
- `db/client.ts` is the only file naming `better-sqlite3`.

## Adding a field to a model

1. `lib/domain/models/<thing>.ts` — add it to the input schema.
2. `lib/server/db/schema.ts` — add the column.
3. `npm run db:generate` — commit the generated SQL.
4. `lib/server/db/mappers.ts` — map both directions.
5. `lib/server/repositories/<thing>.repository.ts` — include it in `toRowValues`
   and in the merge inside `update`.
6. The form and the API client already have the type; fix what `npm run check`
   points at.

## Conventions

- **Types**: `npm run check` must be clean — zero errors, zero warnings. The
  project runs `strict` plus `noUncheckedIndexedAccess`, so index access is
  `T | undefined`; handle it rather than asserting.
- **Svelte 5 runes only.** `$props`, `$state`, `$derived`, `$effect`. Where local
  state is deliberately seeded from a prop once, mark it
  `// svelte-ignore state_referenced_locally` with a line saying why.
- **Binding a discriminated union**: bind through a small `get`/`set` proxy
  object (see `RecurrenceEditor.svelte`) rather than narrowing at the call site.
- **Dates**: calendar days are `YYYY-MM-DD` strings handled by
  `$domain/services/date.ts`, which converts via local midday so DST cannot shift
  a day. Never do date maths with raw `Date` arithmetic.
- **Durations**: milliseconds in models and metrics, seconds in anything a user
  types. `formatDuration` for dashboards, `formatClock` for timers.
- **Styling**: Tailwind utilities over custom CSS; semantic tokens
  (`bg-surface`, `text-ink-muted`, `border-line`) over raw colours, so both
  themes follow automatically.
- **Touch targets** are at least 40px on anything reachable mid-session; the
  primary action on a phone sits in the bottom bar.

## Charts

Load the `dataviz` skill before adding or changing one. The palette in
`app.css` (`--viz-*`) was validated with that skill's script, in both themes:
contrast against the surface, and for `--viz-good` / `--viz-critical` —
the training calendar's only two colours — colour-blind separation as a pair.
If you change a chart colour, re-run the validator rather than eyeballing it.
One series means no legend; axis ticks round to clean durations via
`$domain/services/scale.ts`.

## Runs and metrics

The rules are in the README ("How runs are measured"); in code they live in
exactly one place each — keep it that way:

- **A run's outcome** is `workoutOutcome()` in `lib/domain/models/workout.ts`
  (green / green / yellow / red at 0, ≤30%, >30%, >50% of steps missed).
  `countsInSessionStats()` is the only gate for a session's duration stats;
  `isRecorded()` the only gate for counting a run at all. Screens render an
  outcome through `OutcomeBadge` and never re-derive a threshold.
- **A calendar day's state** is computed in `buildStreakMetrics`; the
  calendar component only maps it to a colour.
- **A run is never resumed.** The run page's load ends any run it finds with
  steps already logged, and the runner always starts at step one. Do not add a
  resume path back.

## Offline

Training works offline; everything else is read-only offline. The README's
"Training offline" section has the behaviour; the shape is:

- **Runs are local-first — one path, online or not.** `lib/client/offline/`
  creates every run on the phone (`runs.start`), stores it in IndexedDB, and
  queues start, steps and finish in the outbox, which delivers in order. Never
  add a second, "online" path that calls `/api/workouts` directly — the two
  would drift. Everything else (library, routines, coach…) stays online-only on
  purpose: no sync engine, no offline edits.
- **Every workout write is idempotent.** A start carries the phone's `id`,
  `startedAt` and `plan`; a replayed start returns the existing workout. Steps
  are an upsert on step index and are accepted even after the run ended (another
  device may have closed it). `finish` carries the phone's `completedAt`.
- **The phone's plan is stored as-is.** That is the one exception to "never let
  the client send a resolved plan": a workout's plan is a record of what was
  run, not an instruction to the library. It is validated against
  `sessionPlanSchema`, must name the same session, and is bounded in size.
- **A start ends only older open runs, and never deletes them** — another phone
  may still hold their steps. Empty, they count nowhere (`isRecorded`).
- **Today is rebuilt on the phone with `buildOccurrences`** (the server's own
  function) from the snapshot's rules. Day logic belongs there, nowhere else.
- **The run page is `ssr = false` with a universal `+page.ts`.** It must open
  with no network, so it can have no `+page.server.ts`.

## Things that will bite (offline)

- **IndexedDB cannot store a Svelte proxy.** State that ends up in IndexedDB is
  `$state.raw`, and `commit()` snapshots values before writing. A plain `$state`
  there fails with "Proxy object could not be cloned".
- **Never `invalidateAll()` on the run page.** Its load would re-run, see the
  steps just logged and end the run as left. The layout skips it there.
- **The heartbeat tells a live run from a left one.** The run page writes
  `cerebro-sport:active-run` every few seconds; opening the app ends runs whose
  beat is stale. `pagehide` clears it synchronously — keep that, or a reload
  looks like a second tab and the run is never ended.
- **Sign-out must wipe** IndexedDB, the `pages-*` caches and the heartbeat
  (`resetOffline`). Cached pages hold the athlete's data.
- **The service worker never `skipWaiting`s by itself.** An update waits and the
  layout offers to reload, never on the run page.
- **`__data.json` redirects are 200s.** A signed-out data request answers
  `{"type":"redirect"}` with status 200; the worker must not cache it, or
  offline the app would send the athlete to sign-in forever.
- **E2E behind a non-default port** needs `BETTER_AUTH_URL` set to that origin,
  or Better Auth answers sign-out with 403 "Invalid origin". Compose always sets
  it.

## The training pack format

`lib/domain/models/pack.ts` defines the import format the Coach page uses. Every
shape there is derived from a domain input schema (`.omit()` + `.extend()`), so
constraints are inherited, never restated — keep it that way.

Three pieces share one source of truth:

- `formatSpec()` in `coach-prompt.ts` is the written contract. Its enumerations
  come from the zod schemas, so a new exercise category appears in the prompt on
  its own.
- The on-page prompt and `SKILL.md` both embed `formatSpec()`.
- `skills/cerebro-sport-session-author/SKILL.md` is **generated**. After changing
  the format, run `npm run skill:write` and commit the result.

`resolvePack()` is pure and is called from both sides: the Coach page renders
its preview from it, and `packService` re-runs it server-side against live data
before writing. Never let the client send a resolved plan for the server to
apply — send the pack and re-resolve.

The importer writes through `exerciseService`, `sessionService` and
`routineService`, so an imported session is validated exactly like a hand-built
one. Do not bypass them for speed.

## Auth

Better Auth owns accounts, sessions, password hashing and roles. Its tables live
in `db/auth-schema.ts`, which is **generated** — after changing the plugins in
`auth/auth.ts`, re-run the generate command in that file's header and then
`npm run db:generate`.

- `auth/auth.ts` imports nothing from SvelteKit, so `scripts/` can use it.
- Sign-in is by **username**; the email column is synthesised by
  `emailForUsername` because no mail is configured. If you ever add real email,
  that function is the one place to change.
- **Public sign-up is a runtime setting**, enforced by the `before` hook in
  `auth.ts` — not by `disableSignUp`. The hook lets sign-up through when the
  instance has no users at all: that is what creates the first admin at boot and
  is the recovery path if every account is deleted.
- **Bootstrap only creates an account on a genuinely empty instance.** If the
  configured `ADMIN_USERNAME` is missing but other accounts exist, it adopts
  orphan rows to the longest-standing admin and creates nothing. Creating one
  there is refused by the sign-up gate, and that error used to propagate out of
  `handle` and 500 every request — see `ensureBootstrapped`, which also never
  caches a rejection and is wrapped in `hooks.server.ts` so only a
  `ConfigurationError` may take the app down.
- Admin actions go through Better Auth's admin API with the caller's headers, so
  it does the authorising. `adminService` adds the guards it does not have
  (no deleting yourself, no removing your own admin role).
- **Deleting a user must purge their data.** That happens in the Better Auth
  `user.delete.after` hook via `purgeUserData`, because the owned tables carry no
  foreign key to `user` — see the comment on `owner` in `schema.ts` for why.

## Deployment

`Dockerfile` + `docker-compose.yml` at the root, and nothing else. The app
applies its own migrations and creates its own first admin at boot, so a deploy
is build and restart — there is no setup step to forget.

Deployment is expected to go through Portainer as a **Git repository stack**,
because the compose file builds from the Dockerfile and a pasted stack has no
source tree. Keep `build:` working; if you ever switch to a published image,
say so in the README rather than leaving both half-configured.

TLS is deliberately out of scope — the app serves plain HTTP and whoever
deploys it puts their own proxy in front. Do not add one back to the compose
file.

- **One replica. Always.** SQLite is a single writer against a single file.
- `GET /api/health` is public (listed in `PUBLIC_PATHS`) and pings the database.
  The container health check probes it, and Portainer surfaces the result; do
  not make it require a session or stop it touching storage.
- `scripts/backup.mjs` is deliberately plain JavaScript and the one place
  outside `db/client.ts` that names better-sqlite3 — it has to run inside the
  runtime image, which carries no TypeScript sources. It uses `VACUUM INTO`;
  never "back up" by copying a live database file.

## Things that will bite

- **Saving a session replaces its whole block/item tree**, so block and item ids
  change on every save. Nothing may store those ids long-term — this is exactly
  why workouts snapshot their plan.
- **`workouts` has no FK to `sessions`** on purpose. Do not add one.
- **`totalMs` is training time: rests in, pauses out** — the sum of the step
  logs' `durationMs`, each of which already excludes paused time. Keep it derived
  in `refreshTotals`, and keep the runner's `totalElapsedMs` the same sum; never
  set it from `Date.now()` differences on the server.
- **`finish` is idempotent and may delete.** A closed tab sends it by beacon,
  possibly after the leave dialog already did; ending a run with nothing done
  deletes it and returns `null`.
- **Step keys are stored on every step log** and stay stable across
  executions. No metric reads them today, but changing how `buildPlan` builds
  `key` would make any future per-step history impossible to rebuild.
- **Occurrence rows only exist for deviations.** `pending` is represented by the
  absence of a row; `resolveOccurrence('pending')` deletes.
- **Cross-account reads return 404, not 403.** Scoping happens in the `where`
  clause, so another user's row is simply not found. Keep it that way — a 403
  would confirm the row exists.
- **`user_id` has a `DEFAULT ''` in the database but not in the drizzle schema.**
  The default exists only so migration `0001` could add the column to a populated
  table; `claimOrphanRows` adopts those rows at first boot. Inserts must always
  state an owner.
- **`npm ci --omit=dev` does not prune this project's dev dependencies.**
  better-auth declares @sveltejs/kit, svelte, drizzle-kit and vitest as
  *optional peer* dependencies, so npm counts our devDependency copies as
  satisfying a production peer and never marks them dev. The Dockerfile needs
  `--omit=dev --omit=peer --omit=optional` — dropping `--omit=optional` silently
  puts vite, typescript and a build toolchain back in the runtime image
  (17 packages / 76 MB becomes 68 / 189 MB). Check with
  `npm ls --omit=dev --omit=peer --omit=optional` after touching dependencies.
- **`overrides` pins better-sqlite3 for better-auth**, whose optional peer wants
  `^12` while we run `^13`. Better Auth never loads that driver — we go through
  the Drizzle adapter — so the override states the truth rather than downgrading.
- **Pack exercise names are matched case-insensitively**, and the library's
  spelling wins over the pack's. An exercise referenced but never declared is
  created as a stub with a warning — not an error, because rejecting the whole
  import over a missing description helps nobody.

## Verifying a change

Anything touching runs, the outbox or the service worker needs a production
build (`npm run build && node build`): the service worker does not behave the
same under `npm run dev`. Test offline by stopping the server *and* with the
browser's offline mode — they exercise different paths (failed requests versus
`navigator.onLine`).

```bash
npm run check          # types + templates
npm run build          # the real bundler check
npm run db:reset && npm run db:seed && npm run dev
```

The seed exercises the whole write path — services, repositories, mappers, plan
builder, recurrence — so if it completes, the domain stack is sound.
