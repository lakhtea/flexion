# 02 — Domain Model

> Read `00-VISION.md` and `01-ARCHITECTURE.md` first. This doc translates the product story into a strict, typed model that both apps share. Every schema here lives in `packages/domain/src/model/` as a Zod schema; Zod is the single source of truth and the static types are derived with `z.infer`.
>
> This doc is the **v1 canonical model**. Entities marked *(Phase 2+)* are sketched for forward compatibility but not implemented in v1.
>
> **Zod version assumption:** all schemas in this doc assume **Zod v3.23 or later**, where `z.record(keySchema, valueSchema)` is the canonical signature and `z.discriminatedUnion` is stable. Pin `zod` in `packages/domain/package.json` to `^3.23.0`. If a future upgrade changes the record API, that's a migration event and gets a `08-MISTAKES.md` entry.

## Terminology (read this first — it prevents half of all bugs)

| Term | Meaning |
|------|---------|
| **Muscle group** | One of the 18 fixed muscles from `MUSCLE_GROUPS` (e.g., "Quads", "Front Delts"). Reference data, not user-editable. |
| **Exercise** | A named, reusable movement (e.g., "Barbell Back Squat") with a muscle stim map. Reference data with user extensions. |
| **Movement / stim map** | `Record<MuscleGroup, 0–5>` — how much each muscle is stimulated by one set of that exercise. Lives on the Exercise. |
| **Program** *(Phase 2+)* | A multi-week plan (mesocycle / microcycle structure). In v1, the "program" is effectively a **WeekTemplate** the user copies each week. |
| **WeekTemplate** | The user's planned split for the week (e.g., "Upper/Lower 4-day"). Reference for `Session.planned`. |
| **Session** | One day's workout. Has a `planned` shape (from the WeekTemplate) and an `actual` shape (what the user did, if anything). A session is the core unit of execution. |
| **Block** | A section of a session (Warm-up / Strength / Accessories / Cardio / Stretching). Blocks group exercises by purpose and drive the UI. |
| **PlannedExercise** / **LoggedExercise** | An exercise instance inside a block. Planned is "this is what we're supposed to do"; Logged is "this is what we actually did." |
| **Set** | A single set. Polymorphic: reps-based, time-based, or note-based. Each set has its own RPE. |
| **Skip** | A first-class record that a planned session was not executed. Has a reason. Muscles stay at whatever volume they had. |
| **Modification** | A first-class record that a planned session was executed differently than planned. Has a reason from the preset library or a free-text custom reason. |
| **MuscleTargets** | The user's per-muscle weekly volume targets (one row per muscle, a number per row). Drives the fatigue gauge math. |
| **Fatigue** | The computed state: for each muscle, `{ executed, target, zone, % }`. NEVER stored — always computed from the logged sessions. |
| **Layout** | The sandbox-mode grid state for a surface (dashboard, etc.) × device class. Persisted. |
| **Modification preset** | A named, reusable template for a common modification that happens *inside* a session ("Dropped to 3 sets — tired", "Substituted — no barbell available", etc.). Reference data + user-extensible. |
| **Skip preset** | A named, reusable template for a *reason to skip* an entire session ("Not feeling it", "Injury", "Time constrained"). Distinct from Modification preset because Skip and Modification are distinct entities — a skip zeros out the whole session, a modification changes what was logged inside one. |

Use these words consistently. When code says `Session`, it means this; when docs say `Session`, they mean this. If a new concept shows up that doesn't fit, add it here first.

## Entity relationship sketch

```
User ──1──┐
          ├──N──> MuscleTargets         (one row per MuscleGroup)
          ├──N──> WeekTemplate          (one per split the user has designed/picked)
          ├──N──> Session               (one per day of actual use)
          ├──N──> Layout                (one per (surface, deviceClass))
          └──N──> CustomExercise        (user-added exercises)

WeekTemplate ──N──> DayTemplate ──N──> PlannedBlock ──N──> PlannedExercise ──N──> PlannedSet

Session ──1──> DayTemplate (source)
Session ──N──> LoggedBlock ──N──> LoggedExercise ──N──> LoggedSet
Session ──0/1──> Skip    (mutually exclusive with a populated LoggedBlock list)
Session ──0/N──> Modification   (each is a recorded delta between planned and logged)

Exercise ──1──> MuscleStimMap     (reference data)
Exercise ──N──> ExerciseAlternative
ExerciseAlternative ──1──> Exercise (target of the swap)

ModificationPreset ──> Modification (template)
```

Key invariants:

1. A `Session` has either `skip !== null` **xor** at least one `LoggedBlock`. Never both, never neither once the day is past.
2. A `LoggedSet`'s muscle contribution is always counted against the *logged* exercise, never the planned one. Modifications are the mechanism that changes which exercise is logged.
3. `MuscleTargets` is complete — every `MuscleGroup` in `MUSCLE_GROUPS` has a target row, even if the target is `0` (meaning "ignore this muscle"). There is no "unset" state.
4. `Fatigue` is never persisted. If you find a fatigue field in a table, it's a bug — delete it.

## Entities (v1)

Each entity section gives: **purpose**, **shape** (in TS/Zod pseudocode — the real file will be the source of truth), **invariants**, **storage location**, and **access patterns**. Storage dictates the Dexie schema decisions in §"Persistence schema" below.

### MuscleGroup (reference data, frozen enum)

**Purpose:** the 18 fixed muscle groups. Not user-editable. Matches the prototype's `MG` array, cleaned up and documented.

```ts
export const MUSCLE_GROUPS = [
  'Chest', 'Front Delts', 'Side Delts', 'Rear Delts', 'Triceps', 'Biceps',
  'Lats', 'Upper Back', 'Lower Back', 'Traps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves',
  'Hip Flexors', 'Adductors', 'Core', 'Forearms',
] as const;

export type MuscleGroup = typeof MUSCLE_GROUPS[number];
```

**Invariants:** immutable. Adding a muscle group is a migration event and requires a `08-MISTAKES.md` entry explaining why.

**Storage:** none — it's a constant in code.

### Exercise (reference data + user-extensible)

**Purpose:** a reusable movement with a muscle stim map, equipment list, and difficulty. The v1 seed library mirrors the prototype's `LIB` (~50 exercises), re-audited against the stim scale.

```ts
export const ExerciseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),                       // stable identifier, e.g. 'barbell-back-squat'
  name: z.string(),
  source: z.enum(['seed', 'user']),       // seed = shipped library, user = custom
  stimMap: z.record(z.enum(MUSCLE_GROUPS), z.number().min(0).max(5)),
  equipment: z.array(z.string()),         // e.g., ['barbell', 'rack']
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  defaultInputMode: z.enum(['reps', 'time', 'note']),
  isUnilateral: z.boolean(),              // doubles set count for muscle accounting when true
  notes: z.string().optional(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;
```

**Invariants (enforced by a Zod `.refine()` on the schema above):**
- `stimMap` values are in the range `(0, 5]` — **zero values are rejected, not tolerated**. Pruning-at-write is not a guideline, it's a schema rule. Two Exercises with semantically equivalent stim maps must serialize identically, or Dexie round-trips will break equality checks and tests will flake.
- `stimMap` must have at least one entry. An exercise that stims no muscles is a programmer error.
- Seed exercises have stable `slug`s that never change across releases. Renames happen via a new seed entry, old one marked deprecated (not deleted).
- `isUnilateral: true` means the reported set count represents one side; the fatigue calculator counts each logged set as *one unit of stim* (not two), because the prototype's volume math already captures work per set. This flag is informational for UI and for programming algorithms, not a math multiplier. **Call out**: if a v2 programming algorithm wants to distinguish "3 sets bilateral" from "3 sets per side," that's when this flag does work.

**Storage:** `exercises` table in IndexedDB/SQLite. Indexed on `slug` (unique), `source`, and `difficulty`.

**Access patterns:**
- "Get all seed exercises" — list with source filter.
- "Get exercise by slug" — unique index.
- "Get all exercises that hit muscle M with stim ≥ 3" — filter over `stimMap`. For v1 this is an in-memory filter over the full seed set (~50 rows); when the library grows we add a denormalized `exercises_by_muscle` table.

### ExerciseAlternative (reference data)

**Purpose:** mirrors the prototype's `ALTS` — for each exercise, a list of substitute exercises with a weight-scaling coefficient that's used **only as a UI prefill hint**.

```ts
export const ExerciseAlternativeSchema = z.object({
  sourceExerciseSlug: z.string(),
  targetExerciseSlug: z.string(),
  weightScale: z.number().min(0),         // 0 = bodyweight, 1 = same, 1.5 = 150%, etc.
  note: z.string().optional(),
});
```

**Important clarification about `weightScale`:** this field is **UI-only prefill**, not fatigue math. When a user taps "swap" mid-session, the weight field is prefilled with `plannedWeight × weightScale` (rounded to the nearest 5 lb, as the prototype does — see `training-tracker.jsx:849-851`). The user can override before logging. **Fatigue math reads the logged weight, never the scaled suggestion.** Swapping an exercise without logging anything changes nothing about the fatigue state.

**Invariants:** `(sourceExerciseSlug, targetExerciseSlug)` is a composite primary key — no duplicate pairs. Both slugs must resolve to a real `Exercise` at seed-load time; a dangling reference is a seed data bug and fails the seed-loader's Zod validation.

**Storage:** `exercise_alternatives` table. Indexed on `sourceExerciseSlug`.

### MuscleTargets (per user)

**Purpose:** the user's weekly volume target per muscle. Drives the fatigue gauge. Defaults come from presets; user overrides one screen deep.

```ts
export const MuscleTargetsSchema = z.object({
  userId: z.string().uuid(),
  goal: z.enum(['strength', 'hypertrophy', 'endurance']),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  targets: z.record(z.enum(MUSCLE_GROUPS), z.number().min(0)),
  // tracks which muscles are user-overridden vs preset-derived, so re-applying
  // a preset (e.g., switching goal) only touches the non-overridden ones:
  overrides: z.record(z.enum(MUSCLE_GROUPS), z.boolean()),
  updatedAt: z.string().datetime(),
});
```

**Invariants (enforced by a Zod `.refine()`):** `targets` has an entry for every `MuscleGroup`. `overrides` has a matching entry. The two records are always aligned. A schema that accepts a partial record here would let a muscle silently have "no target," which the fatigue calculator cannot handle cleanly — better to fail at the schema boundary.

**Storage:** `muscle_targets` table, keyed on `userId`. One row per user, denormalized (all 18 muscles in one row). **Tradeoff (deliberate):** denormalization is query-efficient (one get = all targets) and ideal for v1, where the muscle list is fixed at 18. The cost is that changing the muscle taxonomy (adding a muscle group in v2+) requires a data migration that touches every user row. Acceptable because changing the muscle list is a rare, deliberate migration event and is already called out as one.

**Access patterns:** get, upsert. Only one row per user so no indexes needed beyond the key.

### WeekTemplate (per user)

**Purpose:** the user's designed or chosen split — "Upper/Lower 4-day," "PPL 6-day," etc. Contains seven optional `DayTemplate`s.

```ts
export const WeekTemplateSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  source: z.enum(['preset', 'custom']),
  days: z.record(
    z.enum(['mon','tue','wed','thu','fri','sat','sun']),
    DayTemplateSchema.nullable(),  // null = rest day
  ),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const DayTemplateSchema = z.object({
  label: z.string(),                      // e.g. 'Lower Strength'
  icon: z.string(),                       // emoji from seed set
  blocks: z.array(PlannedBlockSchema),
});

export const PlannedBlockSchema = z.object({
  name: z.string(),                       // 'Warm-up', 'Strength', etc.
  type: z.enum(['warmup','strength','cardio','accessory','stretching']),
  exercises: z.array(PlannedExerciseSchema),
});

export const PlannedExerciseSchema = z.object({
  exerciseSlug: z.string(),
  inputMode: z.enum(['reps','time','note']),
  plannedSets: z.array(PlannedSetSchema),
  routineId: z.string().optional(),       // if this is a named routine (warmup, stretch)
});

export const PlannedSetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reps'), reps: z.number().int().positive(), weight: z.number().nonnegative(), bw: z.boolean(), targetRpe: z.number().min(1).max(10).nullable() }),
  z.object({ kind: z.literal('time'), seconds: z.number().positive(), weight: z.number().nonnegative(), bw: z.boolean(), targetRpe: z.number().min(1).max(10).nullable() }),
  z.object({ kind: z.literal('note'), note: z.string(), targetRpe: z.number().min(1).max(10).nullable() }),
]);
```

**Invariants (enforced by a Zod `.refine()` — not by `z.record` alone, which accepts partial records):**
- Exactly seven keys in `days`, one per weekday. Rest days are explicitly `null`. The refinement asserts `Object.keys(days).length === 7 && DAY_KEYS.every(k => k in days)` and fails validation otherwise.
- `exerciseSlug` must resolve to an `Exercise` at read time; a dangling slug is a migration bug and the read returns a typed `DanglingExercise` placeholder rather than throwing.
- `targetRpe` is explicitly nullable to kill the prototype's silent-default-to-5 bug (`training-tracker.jsx:217`). A null target means "no target"; a null in `LoggedSet.rpe` means "not recorded" and fatigue math excludes that set with a warning (§`03-FATIGUE-SYSTEM.md`).

**Storage:** `week_templates` table. Indexed on `userId`.

### Session (per user per day)

**Purpose:** one day's workout. The core unit of execution.

```ts
export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  weekTemplateId: z.string().uuid(),
  date: z.string().date(),                // YYYY-MM-DD in user's local time
  dayKey: z.enum(['mon','tue','wed','thu','fri','sat','sun']),
  planned: DayTemplateSchema.nullable(),  // snapshot at session creation
  loggedBlocks: z.array(LoggedBlockSchema),
  skip: SkipSchema.nullable(),            // present iff the day was skipped
  modifications: z.array(ModificationSchema),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  notes: z.string().optional(),
});
```

**Invariants (enforced by a Zod refinement — time-independent):**

A session is in one of three states, and the refinement asserts the shape of each:

1. **Pristine** — not yet started, not yet skipped.
   - `skip === null`, `loggedBlocks === []`, `modifications === []`, `startedAt === null`, `endedAt === null`.
   - This is the state a session enters at creation time (from the WeekTemplate), and it's legal on any date, past or future. A past-dated pristine session means "the day passed and the user did nothing and didn't mark a skip" — see §"Catch-up and pristine-past sessions" below.
2. **Skipped** — explicitly not executed.
   - `skip !== null`, `loggedBlocks === []`, `modifications === []`, `startedAt === null`, `endedAt === null`.
3. **Executed** — has logged work.
   - `skip === null`, `loggedBlocks.length > 0`, `startedAt !== null`. `endedAt` may be null if the session is in progress or `!== null` if it's complete. `modifications` may be empty or populated.

No session may simultaneously be skipped *and* executed. No session may have `startedAt !== null` *and* `loggedBlocks === []` (starting a session means you logged something).

**Catch-up and pristine-past sessions.** A past-dated session in the pristine state is semantically "the user ghosted this day." The fatigue calculator treats it as a zero-contribution session (identical to a skip, but without a recorded reason).

**The app never auto-marks a pristine-past session.** No automatic "skip after 24h," no default reason invented on the user's behalf. The user asked for this explicitly — inventing state is a trust violation. Instead, the dashboard shows a gentle, specific nudge using the planned session's content:

> *"Let us know how your squats went."*

The copy template is `"Let us know how your {primary_exercise_name} went."` where `primary_exercise_name` is the planned session's highest-stim exercise (tiebreaker: first one in the block list). Tapping the nudge opens the backfill flow, where the user can either log the session as it happened or mark it skipped with a reason. The nudge is persistent but unobtrusive — it does not block the dashboard, it does not escalate over time, and it never auto-resolves. If the user wants to let it sit, it sits.

This keeps the invariant stateless (there is no "auto-skipped-pending" state — a session is pristine, skipped, or executed, nothing else) while preserving the user's agency over their own history.

- `planned` is a **snapshot** at the time the session was created from the WeekTemplate. Editing the WeekTemplate later does not retroactively change historical sessions. History is immutable.
- `date` is stored as `YYYY-MM-DD` (not a full datetime) so DST and travel are sane. The `startedAt`/`endedAt` capture the actual clock times.

**Storage:** `sessions` table. Compound index on `(userId, date)` for dashboard queries ("this week's sessions").

**Access patterns:**
- "This week's sessions for user U" — range query on `(userId, date BETWEEN weekStart AND weekEnd)`.
- "All sessions for user U that touched muscle M" — iterates sessions, expands `loggedBlocks`, filters by stim map. Expensive; v1 does this in-memory over a bounded window. Phase 2+ denormalizes into a `session_muscle_index` table.
- "Get session by id" — primary key.

### LoggedBlock / LoggedExercise / LoggedSet

Mirror the planned shapes, with two differences:

1. **LoggedSet replaces `targetRpe` with `rpe`** — the actual RPE the user recorded. Nullable. A null RPE means "not recorded," and the fatigue math flags it.
2. **LoggedExercise records `substitutedFrom`** — if the user swapped the exercise mid-session, this field holds the original `exerciseSlug`. This is how we distinguish "the user did what was planned" from "the user did something else" without relying on string comparison of names.

```ts
export const LoggedSetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('reps'),
    reps: z.number().int().nonnegative(),
    weight: z.number().nonnegative(),
    bw: z.boolean(),
    rpe: z.number().min(1).max(10).nullable(),
    outcome: z.enum(['completed', 'dropped']),  // explicit; no sentinel values
  }),
  z.object({
    kind: z.literal('time'),
    seconds: z.number().nonnegative(),
    weight: z.number().nonnegative(),
    bw: z.boolean(),
    rpe: z.number().min(1).max(10).nullable(),
    outcome: z.enum(['completed', 'dropped']),
  }),
  z.object({
    kind: z.literal('note'),
    note: z.string().min(1),
    rpe: z.number().min(1).max(10).nullable(),
    outcome: z.enum(['completed', 'dropped']),
  }),
]);

export const LoggedExerciseSchema = z.object({
  exerciseSlug: z.string(),
  substitutedFrom: z.string().nullable(),  // planned slug, or null if exercise is as-planned
  inputMode: z.enum(['reps','time','note']),
  loggedSets: z.array(LoggedSetSchema),
});
```

**Invariants:**
- `outcome === 'dropped'` is the *only* way to represent a set the user started but bailed on. **No magic-number sentinel** (the prototype would have used `reps: 0`; this schema makes the intent explicit). A dropped set contributes zero to fatigue regardless of its logged values, but the record is preserved — partial reps/time/weight can still be shown in history.
- `outcome === 'completed'` with `reps: 0` (for reps-kind) is illegal and caught by a Zod refinement. A completed zero-rep set is a bug.
- `weight: 0` with `bw: false` is illegal (it's either bodyweight or it has weight); Zod refinement catches this.
- Note-kind sets must have non-empty `note`. A completed note-set with an empty string is a UI bug that shouldn't persist.
- **Note-kind sets contribute zero to fatigue by design** (free text isn't countable), but the fatigue calculator emits a structured `note-set-not-counted` warning for each one so the user knows the cardio/activity wasn't counted against any muscle. See `03-FATIGUE-SYSTEM.md` for the warning taxonomy.

### Skip (first-class, replaces "did nothing today")

**Purpose:** a recorded, reasoned decision not to execute a planned session. A first-class citizen because skips are *information*, not absence of information.

```ts
export const SkipSchema = z.object({
  reason: z.enum([
    'rest-day-planned',      // rest day the user explicitly took
    'rest-day-earned',       // recommender said "rest day"
    'schedule-conflict',
    'injury',
    'illness',
    'travel',
    'low-energy',
    'other',
  ]),
  customReason: z.string().optional(),    // free text when reason is 'other' or 'injury' etc.
  recordedAt: z.string().datetime(),
});
```

**Invariants:**
- `customReason` is required when `reason === 'other'`; Zod refinement enforces it.
- A skip is immutable once recorded. Changing your mind and doing the workout means creating a new session for the same date; see `03-FATIGUE-SYSTEM.md` for how this affects the weekly gauge.

### Modification (first-class, records actual-vs-planned deltas)

**Purpose:** when the user executes a session but changes it (substitutes an exercise, drops sets, deloads intensity), the modification is a structured record. This gives us auditable history and powers analytics later ("you deload every fourth week without realizing it").

```ts
export const ModificationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'exercise-substituted',
    'set-dropped',
    'set-added',
    'volume-reduced',        // reps down
    'intensity-reduced',     // weight down
    'intensity-increased',
    'block-skipped',         // e.g., skipped the warmup
    'block-added',           // e.g., added a cardio finisher
    'custom',
  ]),
  presetId: z.string().uuid().nullable(),  // reference into ModificationPreset library
  reason: z.string(),                      // always populated; preset provides the default text
  targetBlockIndex: z.number().int().nonnegative().nullable(),
  targetExerciseIndex: z.number().int().nonnegative().nullable(),
  delta: z.record(z.unknown()),            // type-specific payload (e.g., { setsDropped: 1 })
  recordedAt: z.string().datetime(),
});
```

**Invariants:** `presetId` may be null (custom modification) but `reason` is never null — a custom modification still requires the user to type *something*, because a reason-free modification is a bug magnet.

**Storage:** inlined in the `Session`, not a separate table. Modifications only make sense in the context of their session.

### ModificationPreset (reference data + user-extensible)

**Purpose:** the common-modifications library for changes *within a session*. Ships with a small seed set that covers the most frequent in-session deviations. Users can star their own custom modifications as new presets.

```ts
export const ModificationPresetSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(['seed', 'user']),
  type: ModificationSchema.shape.type,     // one of the Modification types above; NEVER 'skip'
  label: z.string(),                       // short button text, e.g., "Dropped a set — tired"
  defaultReason: z.string(),               // longer text that prefills Modification.reason
  icon: z.string(),                        // emoji
  frequencyHint: z.enum(['common','uncommon']),
});
```

**Seed library (v1):** 9 presets. These are in-session modifications only — *skip* reasons live in `SkipPreset` below, which is a separate entity.

1. `exercise-substituted` × Equipment — "Rack was taken; swapped"
2. `exercise-substituted` × Variation — "Trying a variation"
3. `set-dropped` × Tired — "Form was breaking down"
4. `set-dropped` × Time — "Ran out of time"
5. `set-added` × Feeling strong — "Felt good, added a top set"
6. `volume-reduced` × Deload — "Deload week"
7. `intensity-reduced` × Deload — "Intentional lighter day"
8. `block-skipped` × Warmup — "Already warm from commute"
9. `custom` — freeform entry point (no preset text)

**Storage:** `modification_presets` table, indexed on `source` and `type`.

### SkipPreset (reference data + user-extensible)

**Purpose:** named templates for *reasons to skip an entire session*. Skip and Modification are distinct entities (see Terminology), and so are their presets. Mixing them in the first draft of this doc was a contradiction caught by review and corrected — see `08-MISTAKES.md` 2026-04-09 entry #3.

```ts
export const SkipPresetSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(['seed', 'user']),
  reason: SkipSchema.shape.reason,         // one of the Skip.reason enum values
  label: z.string(),                       // short button text
  defaultCustomReason: z.string().optional(), // prefill when Skip.customReason is required
  icon: z.string(),
  frequencyHint: z.enum(['common','uncommon']),
});
```

**Seed library (v1):** 6 presets covering the most common skip reasons:

1. `rest-day-planned` — "Scheduled rest"
2. `low-energy` — "Not feeling it"
3. `injury` — "Something hurts; backing off"
4. `illness` — "Sick"
5. `schedule-conflict` — "No time today"
6. `travel` — "On the road"

These are *starting points*. The real test is whether a user, six weeks in, has added their own presets because the defaults weren't enough. If they haven't, the seed list is too broad. If the seed list is the only thing they use, we got it right.

**Storage:** `skip_presets` table, indexed on `source` and `reason`.

### Layout (sandbox-mode state)

**Purpose:** where every widget lives on the grid for a given (user, surface, device class). The schema shape here is a sketch — `06-SANDBOX-MODE.md` owns the authoritative definition.

```ts
export const LayoutSchema = z.object({
  userId: z.string().uuid(),
  surface: z.enum(['dashboard']),          // v1 has only the dashboard
  deviceClass: z.enum(['phone','tablet','desktop']),
  gridCols: z.number().int().positive(),
  placements: z.array(WidgetPlacementSchema),
  updatedAt: z.string().datetime(),
});

export const WidgetPlacementSchema = z.object({
  placementId: z.string().uuid(),          // unique per instance (NOT per widget type — see 05-COMPONENTS "Multi-instance widgets")
  widgetKey: z.string(),                   // identifies the widget TYPE, e.g. 'flexion.weekly-volume-bar'
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
  w: z.number().int().positive(),          // width in grid cells
  h: z.number().int().positive(),          // height in grid cells
  openState: z.enum(['closed','open']),    // the two-state reveal mentioned in 00-VISION
  config: z.record(z.unknown()).optional(),// per-widget-INSTANCE config (e.g., { muscle: 'Quads' })
});
```

**Invariants:**
- Placements do not overlap. The sandbox reducer enforces this on every move/resize; persistence is a dumb store that trusts the reducer.
- `widgetKey` must resolve to a registered widget at render time; unknown keys render as "Missing widget" placeholders, not crashes.

**Storage:** `layouts` table. Composite primary key `(userId, surface, deviceClass)`.

## Persistence schema (Dexie — v1 web)

Dexie tables and their indexes, derived from the access patterns above:

```ts
db.version(1).stores({
  exercises: '&slug, source, difficulty',
  exercise_alternatives: '&[sourceSlug+targetSlug], sourceSlug',
  muscle_targets: '&userId',
  week_templates: '&id, userId',
  sessions: '&id, [userId+date], userId',
  modification_presets: '&id, source, type',
  skip_presets: '&id, source, reason',
  layouts: '&[userId+surface+deviceClass]',
});
```

Notation: `&` = primary key (required on compound primary keys as well — `&[a+b]`, not bare `[a+b]`). Bare `[a+b]` is a secondary compound index; without the `&`, the uniqueness constraint is lost. A bug in the first draft of this doc — see `08-MISTAKES.md` — missed the `&` on `layouts` and `exercise_alternatives` and would have silently allowed duplicate rows.

**Conformance tests** (lives in `packages/domain/test/adapter-conformance.ts`): every adapter (Dexie on web, expo-sqlite on mobile, future Supabase) runs the same suite — seed round-trips, range queries, upsert semantics, tombstone handling. Adapters that don't pass are not merged.

## Migrations strategy

- Dexie version bumps are the migration mechanism on web.
- Every schema change gets a **paired migration function** that takes the old rows and produces new rows — no "just recreate the DB" shortcuts.
- Migrations are tested: a fixture of v1 data runs through every intermediate version on every test run. If the chain breaks, CI fails.
- Seed data (exercises, alternatives, modification presets) is re-hydrated on every app start, not migrated. Seed updates are a rehydrate, not a schema change.
- **Anti-rule:** no `any` in migration code. Old-shape and new-shape both get Zod schemas and the migration is a pure function between them. Casts are not allowed.

## Validation policy

- **Every value crossing a persistence boundary is Zod-validated** on the way in and the way out. Zod is cheap; corrupted state is not.
- **Every value crossing the sandbox boundary** (widget config blobs, placements) is Zod-validated.
- **Within a single domain function**, values are trusted — no defensive re-validation.
- Validation errors are structured events: `logger.warn('validation-failed', { entity, issues: err.issues })`. They are not swallowed.

## Test invariants (pinned in `packages/domain/test/`)

These are the tests that must exist before the domain package is marked Phase 1 complete. Every one of them corresponds to a claim in this doc:

1. `MUSCLE_GROUPS` has exactly 18 entries, in the documented order.
2. A `Session` with `skip !== null` and non-empty `loggedBlocks` fails Zod validation.
3. A `MuscleTargets` missing any muscle fails Zod validation.
4. A `LoggedSet` with `weight: 0, bw: false` fails Zod validation.
5. A `ModificationPreset` with `type === 'custom'` and empty `defaultReason` is legal (custom is freeform).
6. A `WeekTemplate` with fewer than 7 day keys fails Zod validation.
7. Round-trip: seed `Exercise` → Dexie → read back → deep-equals original.
8. Round-trip: `Session` with a mix of logged exercises, substitutions, and modifications → Dexie → read back → deep-equals original.
9. The `PersistenceAdapter` conformance suite passes against the Dexie adapter.
10. Migration from a hand-built "v0.9 sample" fixture to v1 produces a valid v1 `Session` and does not lose any logged sets.

## Phase 2+ sketches (not implemented in v1)

These are named so the v1 model does not accidentally close the door on them.

- **Program / Mesocycle / Microcycle.** A `Program` is a sequence of `Mesocycle`s; each mesocycle is a sequence of `Microcycle`s that are WeekTemplates with progressive overload rules (e.g., "add 5 lbs per week on compounds"). v1's "week template you copy" is the base case of a Program with one mesocycle containing one microcycle repeating indefinitely.
- **Readiness signal.** A separate, additive gauge (*not* a replacement for the volume gauge) that models physiological recovery using inputs like sleep, HRV, perceived energy. Feeds into the recommender as a *modifier*, not a primary driver.
- **Trainer-authored plans.** A `HumanAuthoredPlan` entity that implements the same `Recommender` interface. Requires identity, payments, vetting — all deferred.
- **Denormalized muscle indexes.** `session_muscle_volume` table that pre-aggregates fatigue contributions per (userId, weekStart, muscle). Only needed when sessions accumulate past ~500 per user; v1 scans in-memory.

## What this doc is the boss of

- Every type in `packages/domain/src/model/` must match this doc. Drift is a bug.
- Every Dexie table and index must match this doc. Drift is a bug.
- Every test in `packages/domain/test/` whose name starts with `model.` must correspond to an invariant in this doc.

If a consumer of the domain package needs a type that isn't here, the answer is to extend this doc first and the code second, not the other way around.
