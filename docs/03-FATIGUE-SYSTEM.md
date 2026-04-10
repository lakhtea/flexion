# 03 — Fatigue System

> This is the crown jewel of Flexion. It is also the doc that most directly constrains the product — if the math here is wrong, every downstream feature is wrong, and if the math here is *right* the whole product story becomes legible.
>
> Read `00-VISION.md` and `02-DOMAIN-MODEL.md` first. This doc is the formal spec of Thesis 1.

## What "fatigue" means in this app (precise definition)

Flexion's fatigue model is a **weekly plan-execution gauge**. Per muscle group, it answers one question:

> *"What fraction of this week's target volume for this muscle has been executed?"*

It is **not**:

- A physiological recovery gauge. It does not model soreness or nervous-system recovery across days.
- A cumulative long-term damage signal.
- An LLM guess.
- Something that persists — fatigue is always recomputed from logged sessions.

It **is**:

- A deterministic function `fatigue(loggedSessions, muscleTargets, weekBounds) → FatigueState`.
- A single source of truth for "what muscle should you hit next."
- Explainable: every number on the dashboard has a traceable provenance back to individual logged sets.

If at any point the fatigue system drifts away from this definition — for example, if someone tries to add exponential decay to the "current" number rather than building a separate readiness gauge — the drift is wrong and should be caught in review.

## The contract (`packages/domain/src/fatigue/`)

```ts
export interface FatigueState {
  weekStart: string;                       // YYYY-MM-DD (Monday in user's local time)
  weekEnd: string;                         // YYYY-MM-DD (Sunday)
  muscles: Record<MuscleGroup, MuscleFatigue>;
  warnings: FatigueWarning[];              // structured issues encountered during computation
}

export interface MuscleFatigue {
  muscle: MuscleGroup;
  executed: number;                        // volume units executed this week
  target: number;                          // weekly target (from MuscleTargets)
  pct: number;                             // executed / target, clamped to [0, 2]
  zone: 'under' | 'at' | 'over' | 'unset'; // 'unset' when target === 0
  contributingSetCount: number;            // number of logged sets that counted
}

export type FatigueWarning =
  | { kind: 'rpe-missing'; sessionId: string; setRef: SetRef; }
  | { kind: 'unknown-exercise'; sessionId: string; exerciseSlug: string; }
  | { kind: 'zero-stim'; sessionId: string; exerciseSlug: string; }
  | { kind: 'note-set-not-counted'; sessionId: string; exerciseSlug: string; note: string; };

export function calcFatigue(
  sessions: readonly Session[],
  targets: MuscleTargets,
  weekBounds: { start: string; end: string },
  exerciseIndex: ReadonlyMap<string, Exercise>,
): FatigueState;
```

Key properties:

- **Pure function.** No side effects, no I/O, no randomness. Same inputs → same output, byte-for-byte.
- **Accepts an exercise index** as an explicit argument. The fatigue calculator does *not* import the exercise library directly — the caller injects it. This makes the function trivially testable and keeps the domain layer decoupled from reference-data loading.
- **Warnings are structured.** Silent defaults are forbidden (this is the prototype's RPE-defaults-to-5 bug; see `08-MISTAKES.md`). When the math can't produce a clean answer, it produces a clean warning.
- **The clamp at `pct ≤ 2`** prevents a user who logs ridiculous volume from breaking the UI. 200% is the display ceiling; above that, the bar shows 200% with a "🔥 overshoot" icon.

## The volume formulas

A single logged set contributes **volume units** to each muscle it stimulates. The formula has three branches matching the set's kind, and a final distribution step that splits the volume across muscles using the exercise's stim map.

### Per-set volume (before muscle distribution)

```
# REPS-WITH-WEIGHT (the strength/accessory case)
volume_set = (weight_lb × reps × rpe_factor) / 100

# TIME-BASED (cardio, timed carries, stretches)
volume_set = (seconds / 60) × rpe_factor × TIME_COEFF

# REPS-ONLY (bodyweight reps, or weight omitted)
volume_set = reps × rpe_factor × REPS_ONLY_COEFF

# NOTE-BASED (free-text sets, e.g., "5 mi @ 9:00")
volume_set = 0   # not counted toward any muscle — but NOT silently:
                 # the calculator emits a `note-set-not-counted` warning per
                 # note set, so the user is told explicitly that their cardio
                 # or free-text activity wasn't counted against any muscle.
                 # If users complain their runs aren't counted, the product
                 # answer is to log the run as a time-based 'Easy Run' exercise
                 # (which IS in the stim library) instead of as a note set.
```

Where:

- `rpe_factor = rpe === null ? SKIP : rpe / 10` — the prototype's silent default is gone. Sets with no RPE emit a `rpe-missing` warning and **do not contribute to fatigue**. The warning shows in the UI as "N sets not counted this week (missing RPE)" with a one-tap fix.
- `TIME_COEFF = 0.5` — carried over from the prototype. Rationale: one minute of time-under-tension at RPE 10 should map to about half the volume of a weighted set (empirical calibration; revisit after v1 with real data).
- `REPS_ONLY_COEFF = 0.3` — same source, same caveat.

### Muscle distribution

```
for each muscle M in exercise.stimMap:
  stim_M = exercise.stimMap[M]                 # 0..5
  muscle_contribution_M = volume_set × (stim_M / 5)
```

The division by 5 normalizes the stim scale so a primary mover (stim 5) gets the full volume unit, a secondary mover (stim 3) gets 60%, etc. This matches the prototype's intent and is preserved.

### Worked examples

**Example 1: heavy squat**

- Exercise: Barbell Back Squat, stim map `{ Quads: 5, Glutes: 4, Hamstrings: 2, Core: 2, 'Lower Back': 2 }`.
- Set: 185 lb × 8 reps, RPE 8.
- `volume_set = (185 × 8 × 0.8) / 100 = 11.84`
- Contributions: Quads +11.84, Glutes +9.47, Hamstrings +4.74, Core +4.74, Lower Back +4.74.

**Example 2: 5-minute easy run**

- Exercise: Easy Run, stim map `{ Quads: 1, Hamstrings: 1, Calves: 2, 'Hip Flexors': 1 }`.
- Set: 300 seconds, RPE 4 (easy).
- `volume_set = (300 / 60) × 0.4 × 0.5 = 1.0`
- Contributions: Quads +0.2, Hamstrings +0.2, Calves +0.4, Hip Flexors +0.2.

**Example 3: bodyweight push-ups with no RPE**

- Exercise: Push-up.
- Set: 15 reps, RPE null.
- Outcome: volume_set = 0 (skipped), a `rpe-missing` warning is emitted, the dashboard shows "1 set not counted — tap to add RPE."

**Example 4: unknown exercise slug**

- Session references `exerciseSlug: 'mystery-lift-9000'` which isn't in the exercise index.
- Outcome: the entire logged exercise is skipped, an `unknown-exercise` warning is emitted, nothing crashes.

Every example in this section will have a corresponding unit test in `packages/domain/test/fatigue.worked-examples.test.ts`. If the numbers in the tests change without this doc changing, the test fails.

## Weekly targets (where they come from)

This is the other half of the gauge: the denominator.

### The default tiers

Defaults are sourced from evidence-based volume landmarks (Schoenfeld, Israetel, Helms-style ranges). The v1 seed is a three-dimensional lookup table:

```
target_default(muscle, goal, level) → number
```

- `goal ∈ {'strength', 'hypertrophy', 'endurance'}`
- `level ∈ {'beginner', 'intermediate', 'advanced'}`
- `muscle ∈ MUSCLE_GROUPS`

The v1 seed table lives in `packages/domain/src/seed/muscle-target-defaults.ts` as a static constant. The numbers are *not* included in this doc because they will be tuned during calibration — but the *structure* is fixed and the *source* (which references we drew from) is documented in the seed file's header comment.

**Staff-level discipline:** the seed file has a comment block at the top citing the literature. If the numbers change, the comment gets updated at the same commit. If someone adds a new muscle group, the seed file fails to compile until defaults are added for every `(goal, level)` combination — TypeScript's exhaustive checks enforce this.

### User overrides

- Targets are stored as a full `Record<MuscleGroup, number>` with a parallel `overrides: Record<MuscleGroup, boolean>` map (see `02-DOMAIN-MODEL.md`).
- When the user changes `goal` or `level` in Settings, we re-apply the preset for every muscle where `overrides[m] === false`. Muscles the user has explicitly overridden are left alone.
- Overrides can be reset one-at-a-time ("use default for Calves") or globally ("reset all to defaults for intermediate hypertrophy").

This is the "automated by default, customizable by exception" principle cashing out in concrete schema.

## The zones

The three zones and their thresholds:

| Zone | Threshold | Meaning | UI treatment |
|------|-----------|---------|--------------|
| **Under** | `pct < 0.85` | "Go hit this." Todo list. | Muted bar, chevron-right icon, tap goes to "recommended exercises for this muscle". |
| **At** | `0.85 ≤ pct ≤ 1.00` | "Done for the week." | Solid bar with a ✓ icon. |
| **Over** | `pct > 1.00` (hard flag at `pct > 1.10`) | "Stop." Warning. | Amber bar at 1.00–1.10, red bar + ⚠ icon above 1.10. The recommender will not select sessions that push this muscle further. |
| **Unset** | `target === 0` | User has set this muscle to "ignore." | Gray bar, no label. No zone evaluation. |

**Boundary semantics (explicit — do not guess):**

- `pct === 0.85` is in **at** (the boundary is `<` on the under side, `≤` on the at side). Tested by `thresholds.under-boundary.test.ts`.
- `pct === 1.00` is in **at** (`≤ 1.00` is inclusive). Tested by `thresholds.at-boundary.test.ts`.
- `pct === 1.10` is still in **over**, but in the *amber* band (1.00 < pct ≤ 1.10). Strictly above 1.10 is the red band. Tested by `thresholds.over-boundary.test.ts`.
- `target === 0` short-circuits: `pct` is reported as `0` (not NaN, not Infinity), `zone` is `unset`, and the muscle contributes nothing to any recommender decision. **No division by zero ever reaches the caller** — the calculator's `computePct(executed, target)` function returns `0` when target is `0`.
- The clamp at 2.0 applies to the *reported* `pct` in every code path. Internally the uncapped value is preserved in the warning payload so we can surface "your execution is 3.4× your target — consider raising your target or backing off" as a specific coaching message.

**Why 85%?** The upper end of "under" needs to be generous enough that a user who's 80% of the way through the week feels close (and is encouraged to finish) without being *at* the target yet. 85% is a round number inside the literature's MAV range. This is a calibration knob — if users complain it feels wrong, change the constant and log the change in `08-MISTAKES.md`.

**Why 110% as the hard flag?** Because one extra set over the target isn't a crime, but 10% over is a real overshoot. The amber zone (100–110%) is "you're done, don't push it"; the red zone (>110%) is "stop; a real trainer would say no right now."

All four numbers (0.85, 1.00, 1.10, and the 2.0 clamp) live as named constants in `packages/domain/src/fatigue/thresholds.ts`. Each has a comment explaining its origin. A test in `fatigue.thresholds.test.ts` pins each one to the value documented here — if someone changes a threshold without updating this doc, the test fails.

## Skip and modify: how they affect the math

This is what makes the v1 model work without cross-day decay.

### Skipping a session

A `Session` with `skip !== null` contributes **zero** to fatigue. The planned work is not counted as executed. The bar reflects reality: the muscles that would have been hit are still as low as they were. This is correct, and this is the whole reason the v1 model is legible without modeling recovery.

The UI treatment: skipped sessions show in the dashboard's week view as a grayed-out card with the skip reason, so the user sees *why* their quads are at 30%. The recommender, tomorrow, will see the low quad number and adjust.

### Modifying a session

A `Session` with modifications is treated by fatigue as follows: **only what's in `loggedBlocks` counts.** Modifications are metadata — they explain *why* the logged content differs from the planned content, but they don't enter the math. The math reads logged sets, period.

Concretely:

- **Exercise substitution** — the logged exercise is the substitute; its stim map is used. The original plan is not counted.
- **Set dropped** — there are fewer logged sets, so the sum is smaller.
- **Set added** — there are more logged sets, so the sum is larger.
- **Volume reduced** (fewer reps) — each set's `volume_set` is smaller.
- **Intensity reduced** (lower weight) — each set's `volume_set` is smaller.
- **Block skipped** — that block has zero logged exercises, contributing nothing.
- **Custom modification** — if the user kept the logged sets the same and only added a note, the math is unchanged; the modification is an annotation.

This is elegant because the math only ever has to look at logged sets. Modifications are for humans, not for the fatigue calculator.

## The recommender (Thesis 1 cashes out)

```ts
export type Recommendation =
  | { kind: 'session'; session: PlannedSession; rationale: Rationale }
  | { kind: 'rest-day'; rationale: Rationale };

export interface Rationale {
  summary: string;                         // one-sentence human-readable explanation
  underTargetMuscles: MuscleGroup[];       // why this session was chosen
  avoidedMuscles: MuscleGroup[];           // what was ruled out
  signals: Array<{ key: string; value: unknown }>; // machine-readable decision trace
  // Example signals actually emitted by the v1 recommender:
  //   { key: 'top_template_score',   value: 12 }
  //   { key: 'all_template_scores',  value: [['Upper Heavy', 12], ['Lower Heavy', 8]] }
  //   { key: 'k_size',               value: 3 }
  //   { key: 'time_budget_minutes',  value: 45 }
  //   { key: 'dropped_exercises',    value: ['calf-raise', 'forearm-curl'] }
  //   { key: 'reason',               value: 'rest-day-all-over-target' }  // when rest-day
}

export interface Recommender {
  recommend(input: {
    fatigueState: FatigueState;
    weekTemplate: WeekTemplate;
    today: string;                         // YYYY-MM-DD
    availableTimeMinutes: number | null;
  }): Recommendation;
}
```

### The v1 algorithm (deterministic, explainable)

**Helper definitions used below:**

```
# Per-exercise stim contribution to a muscle M
exercise_stim(e, M) = exerciseIndex[e.exerciseSlug].stimMap[M] || 0

# Template-level aggregate: the MAX stim across all exercises in the template
# for a given muscle. (Max, not sum, because "hits the quads" is a yes/no
# property of a template — duplicate quad exercises don't multiply the effect.)
template_stim(t, M) = max(exercise_stim(e, M) for e in all_exercises_in(t))

# Per-exercise score — used in step 8 for abbreviation
exercise_score(e, K, O) =
    sum(exercise_stim(e, m) for m in K)
  - 10 * sum(exercise_stim(e, m) for m in O if exercise_stim(e, m) > 0)
# The 10x penalty is chosen so that any exercise touching a vetoed muscle
# is dropped before any exercise that doesn't. Constant lives in thresholds.ts.
```

**The algorithm:**

```
1. Compute FatigueState for the current week.
2. Let U = muscles where zone === 'under', sorted by pct ascending (lowest first).
3. Let O = muscles where zone === 'over' (strictly > 1.00). These are vetoed.
4. If U is empty:
     return { kind: 'rest-day',
              rationale: "Every muscle is at or above target for this week." }

5. Take K = the top 3 muscles from U.
   (Why 3? A good compound session typically hits 3-5 muscles with high stim —
   squats hit quads/glutes/hams/core/lower-back. Selecting the top 3 under-target
   muscles virtually guarantees a compound-heavy template scores well. 2 is too
   narrow (a single biased session wins); 5 dilutes the signal. Tuning constant
   in thresholds.ts; calibrate against user-reject rate in Phase 5.)

6. Let T = WeekTemplate's DayTemplates (excluding today's if already logged or
   skipped). Score each template:
       score(t) =   sum(template_stim(t, m) for m in K)
                  - 10 * sum(template_stim(t, m) for m in O
                             if template_stim(t, m) > 0)

7. Let t_best = argmax(score(t) for t in T).
   If score(t_best) <= 0:
     # Every available template hits more vetoed muscles than under muscles,
     # OR no template hits any under muscle at all.
     return { kind: 'rest-day',
              rationale: "Every session in your week would push an already-over
                          muscle further, or wouldn't hit any of your under-target
                          muscles. A rest day is the right call." }
   Otherwise, let planned = instantiate_session_from(t_best).

8. Time-budget abbreviation (only if availableTimeMinutes is set).
   Estimate planned_minutes = sum(estimated_minutes(e) for e in planned.exercises).
   If planned_minutes > availableTimeMinutes:
     Sort planned.exercises by exercise_score(e, K, O) ascending (lowest first).
     Drop exercises from the front of the sorted list one at a time, recomputing
     planned_minutes after each drop, until planned_minutes <= availableTimeMinutes
     OR only one exercise remains.
     If only one exercise remains and it still doesn't fit: return
       { kind: 'rest-day', rationale: "You don't have time for a minimum
         effective session today. Rest is better than half-measures." }
     Otherwise return the abbreviated planned session with a rationale noting
     which exercises were dropped and why.

9. Return { kind: 'session', session: planned, rationale: {
     summary: "Your [top-K muscles] are at [pcts] this week. This [template name]
               session hits [under_hit_count] of them without touching your
               [vetoed muscles].",
     underTargetMuscles: K,
     avoidedMuscles: O,
     signals: [
       { key: 'top_template_score', value: score(t_best) },
       { key: 'all_template_scores', value: T.map(t => [t.label, score(t)]) },
       { key: 'k_size', value: K.length },
       { key: 'time_budget_minutes', value: availableTimeMinutes },
       { key: 'dropped_exercises', value: dropped_slugs_or_empty },
     ],
   } }
```

`estimated_minutes(exercise)` is a simple function: `sets × (work_seconds + rest_seconds) / 60`, with defaults from the exercise type (strength = 45s work + 90s rest per set; accessory = 30s + 60s; cardio = seconds field). Constants in `thresholds.ts`.

### Why deterministic

- **Explainability.** Every number above can be shown to the user. Rationale is not generated by an LLM — it is a template filled with structured data.
- **Testability.** Given a fatigue state and a week template, the recommendation is a pure function. Unit tests pin every interesting input.
- **Replaceability.** When human trainers build plans, their `Recommender` implementation skips steps 1–7 and returns the human-authored session for today with a rationale like "Your trainer Sarah scheduled this session on Monday."
- **Conservatism.** No LLM will decide to make you squat through a knee injury because it hallucinated an adjustment. The math says "rest day"; the app says "rest day."

### What the recommender does *not* do (v1)

- It does not do inter-muscle balancing beyond "avoid vetoed muscles" — e.g., it does not try to keep push/pull ratios balanced. This is a known limitation; real trainers do this and v2 will too.
- It does not consider exercise novelty, form progression, or periodization phase.
- It does not integrate sleep, HRV, or self-reported energy. Those are Phase 2+ inputs to a separate readiness signal.
- It does not learn from past recommendations. If the user keeps rejecting the same template, the recommender keeps offering it. Learning is a later phase.

Each of these is called out so that a future maintainer reading this doc knows which *planned omissions* are load-bearing and which are bugs.

## Prototype bugs this doc explicitly fixes

For each bug in `training-tracker.jsx`, the fix:

| Prototype bug | Prototype location | Fix in the rebuild |
|---------------|---|--------------------|
| `const rpe = s.rpe ?? 5` — silently defaults RPE to 5 | `training-tracker.jsx:217` (`const rpe = s.rpe \|\| 5;`) | RPE null means "not recorded" — set is skipped with an `rpe-missing` warning. The UI surfaces these. |
| Stretches/warmups contribute zero fatigue silently (not in `LIB`) | `training-tracker.jsx:211` (`if (!tx) return;` drops unknown exercises without warning) | An exercise missing from the index emits an `unknown-exercise` warning. Seed library is audited so every shipped routine has a stim map (or is intentionally excluded with a warning). |
| No decay, no recovery modeling, but the variable is labeled "fatigue" | `training-tracker.jsx:202-229` | This doc explicitly reframes fatigue as a *weekly plan-execution gauge*, not a recovery model. The user's language is "fatigue" and we preserve it; the precise definition is documented here and in `00-VISION.md`. |
| Deep-clones the entire week on every keystroke | `training-tracker.jsx:760-766` (`JSON.parse(JSON.stringify(p))` inside `up()`) | Fatigue is pure + memoized on `(sessions, targets, weekBounds)` identity. Immer for structural sharing on mutations. |
| Fatigue recomputed on every render | Implicit in `training-tracker.jsx:756` (the `calcFatigue` call in the render body) | Selector-level memoization inside Zustand so only changes to logged sets trigger recompute. |
| Note-based sets contribute zero with no acknowledgement | Implicit — prototype's `calcFatigue` has no branch for note sets | `note-set-not-counted` warning emitted per note set. The UI tells the user explicitly. |
| No tests whatsoever | Entire file | Every formula, threshold, and boundary in this doc has a pinning unit test. |

Each prototype bug also gets a corresponding entry in `08-MISTAKES.md` as the *anti-patterns we refused to port* — the log is a record of what was consciously rejected, not just what went wrong.

## Test invariants (pinned in `packages/domain/test/fatigue/`)

Required before the fatigue package is marked Phase 1 complete. Each invariant corresponds to a claim in this doc.

1. **`calcFatigue` is pure.** Calling it twice with the same inputs returns deep-equal outputs. No hidden state.
2. **No-RPE is skipped, not defaulted.** A logged set with `rpe: null` contributes zero volume and produces exactly one `rpe-missing` warning.
3. **Unknown exercise is warned, not crashed.** A logged exercise with a slug not in the index contributes zero volume and produces one `unknown-exercise` warning.
4. **Worked examples match the doc.** Examples 1–4 above each have a test producing the exact numbers. Drifting from the doc fails the test.
5. **Zone thresholds are pinned.** Constants in `thresholds.ts` equal the values in this doc's zone table.
6. **Clamp at 2.0.** A muscle with `executed = 100 × target` reports `pct: 2.0`, zone `over`.
7. **Override semantics.** Changing `goal` only updates non-overridden muscles; overridden ones are untouched.
8. **Skip doesn't count.** A `Session` with `skip !== null` contributes zero to every muscle.
9. **Substitution uses the new stim map.** A session with an `exercise-substituted` modification counts volume against the substitute's muscles, not the planned exercise's muscles.
10. **Recommender returns `rest-day` when no muscles are under.** Given a fatigue state where every muscle is at/over, the recommender returns a rest-day recommendation with a non-empty rationale.
11. **Recommender vetoes over-target muscles.** Given a fatigue state where Quads are in `over`, no returned session's exercises touch Quads with stim > 0.
12. **Recommender rationale is populated.** Every returned recommendation has `summary`, `underTargetMuscles`, `avoidedMuscles`, and `signals` — none are empty placeholders.
13. **Determinism.** Running the recommender twice on the same state returns the same session (no randomness, no date-sensitive selection).
14. **Performance.** `calcFatigue` for a week with 30 logged sessions completes in <5 ms on CI hardware.

## Calibration knobs (the user-facing settings the math exposes)

These are the only fatigue-system settings the user sees:

1. **Goal** (`strength`/`hypertrophy`/`endurance`) — re-applies non-overridden muscle defaults.
2. **Experience level** (`beginner`/`intermediate`/`advanced`) — same.
3. **Per-muscle target override** — any individual muscle's target can be set directly.
4. **"Ignore this muscle"** — shorthand for `target = 0`. Useful for muscles the user doesn't want to train.
5. **"Reset all to defaults"** — nukes all overrides.

Everything else (the 0.85 threshold, the 1.10 hard cap, the stim scale, the time and reps-only coefficients) is *not* user-facing. Those are calibration constants owned by the team, tuned against data, and changed via commits — not settings menus. A settings screen full of tuning knobs is the sign of a product that doesn't know what it wants.

## Known limitations (honest list)

Every v1 limitation, named so we stop calling them features.

1. **No cross-day recovery.** Accepted scope decision; see `00-VISION.md`.
2. **No individual recovery variance.** Two users with identical logs see identical fatigue states. A real trainer would differentiate.
3. **Stim weights are global.** The stim map for Barbell Back Squat is the same for every user. Real mover biomechanics vary (squat mechanics, limb lengths).
4. **RPE is self-reported and unscalable.** If users under-report, fatigue is underestimated, and the recommender pushes them too hard. A form-check / velocity-based-training layer could correct this in v2.
5. **Hand-tuned volume coefficients.** `TIME_COEFF = 0.5` and `REPS_ONLY_COEFF = 0.3` are inherited from the prototype without recalibration. Users who log a lot of cardio or bodyweight work will see fatigue numbers calibrated to barbell strength training, which means their cardio volume is *probably* undercounted relative to how hard it feels. Acceptable for v1 because the first user is the builder, who does mostly barbell work, and because the calculator emits enough structured data that recalibration in v2 is a one-file change. Recalibration with real user data is a Phase 2 task.
6. **No neural / CNS fatigue.** Heavy 1-rep-max work and high-rep work are counted in the same volume currency.
7. **Weekly reset is a hard boundary.** A user who trains Sunday and Monday sees the Monday work "in a new week," which is fine for v1 framing but physically continuous.
8. **Recommender is memoryless.** It does not learn from which sessions the user rejects, skips, or modifies. Learning is a Phase 5+ feature.
9. **Recommender does not consider push/pull or hinge/squat balance.** Real trainers do. v2 adds balance constraints as an additional scoring term.

Each of these is a candidate for a v2 improvement. Each should have a dedicated section in a future `docs/10-FATIGUE-V2.md` when the v1 baseline is shipped and we have real usage data to calibrate against.

## What this doc is the boss of

- `packages/domain/src/fatigue/` — every file, every constant, every test.
- The `Recommender` interface and its v1 implementation.
- The seed file for default muscle targets.
- The threshold constants.
- The warning taxonomy.

If a component elsewhere in the app wants to "compute fatigue" differently, the answer is no. There is one fatigue calculator, it lives where this doc says it lives, and everyone imports it.
