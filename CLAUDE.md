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
`app.css` (`--viz-*`) was validated with that skill's script — monotone
lightness, ≥0.06 lightness gaps between ramp steps, and ≥2:1 contrast for the
step nearest the surface, in both themes. If you change a chart colour, re-run
the validator rather than eyeballing it. One series means no legend; axis ticks
round to clean durations via `$domain/services/scale.ts`.

## The training pack format

`lib/domain/models/pack.ts` defines the import format the Coach page uses. Every
shape there is derived from a domain input schema (`.omit()` + `.extend()`), so
constraints are inherited, never restated — keep it that way.

Three pieces share one source of truth:

- `formatSpec()` in `coach-prompt.ts` is the written contract. Its enumerations
  come from the zod schemas, so a new exercise category appears in the prompt on
  its own.
- The on-page prompt and `SKILL.md` both embed `formatSpec()`.
- `skills/van-damme-session-author/SKILL.md` is **generated**. After changing
  the format, run `npm run skill:write` and commit the result.

`resolvePack()` is pure and is called from both sides: the Coach page renders
its preview from it, and `packService` re-runs it server-side against live data
before writing. Never let the client send a resolved plan for the server to
apply — send the pack and re-resolve.

The importer writes through `exerciseService`, `sessionService` and
`routineService`, so an imported session is validated exactly like a hand-built
one. Do not bypass them for speed.

## Things that will bite

- **Saving a session replaces its whole block/item tree**, so block and item ids
  change on every save. Nothing may store those ids long-term — this is exactly
  why workouts snapshot their plan.
- **`workouts` has no FK to `sessions`** on purpose. Do not add one.
- **`totalMs` is the sum of step durations**, not wall clock. Keep it derived in
  `refreshTotals`; never set it from `Date.now()` differences.
- **Step keys are the join key for progress metrics.** Changing how
  `buildPlan` builds `key` silently disconnects every existing workout from its
  history.
- **Occurrence rows only exist for deviations.** `pending` is represented by the
  absence of a row; `resolveOccurrence('pending')` deletes.
- **Pack exercise names are matched case-insensitively**, and the library's
  spelling wins over the pack's. An exercise referenced but never declared is
  created as a stub with a warning — not an error, because rejecting the whole
  import over a missing description helps nobody.

## Verifying a change

```bash
npm run check          # types + templates
npm run build          # the real bundler check
npm run db:reset && npm run db:seed && npm run dev
```

The seed exercises the whole write path — services, repositories, mappers, plan
builder, recurrence — so if it completes, the domain stack is sound.
