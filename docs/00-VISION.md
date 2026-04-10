# 00 — Vision

## Problem

People who lift seriously have two recurring questions every week:

1. **"What should I do today?"** — given everything I've already done this week, what's the most useful next session?
2. **"Am I overdoing it?"** — am I about to train a muscle that's already cooked, or skip one I've been neglecting?

The market answer is either (a) a rigid program app that tells you what to do but ignores how your week actually went, or (b) a logging app that records what you did but never tells you whether it was right. Both make you do the synthesis in your head. Most people can't, so they either follow the program blindly or freelance until they plateau.

**Flexion's thesis: fatigue is the missing variable.** If the app knows how much you've trained each muscle this week, and how much it *should* be trained this week, every other question — what to do today, what to swap, what to skip — falls out of that one number.

**A precise note on what "fatigue" means here.** Flexion's fatigue model is **not** a physiological recovery gauge. It does not model soreness, nervous-system depletion, or cross-day recovery. It is a **weekly plan-execution gauge**: each muscle has a target weekly volume (in stim-adjusted volume units, see `03-FATIGUE-SYSTEM.md`), and the bar shows what fraction of that target has been executed this week. Skip a workout → the muscles it would have hit stay low. Swap an exercise → the volume is counted against the new exercise's muscles. Add an extra set → the volume goes up. The word "fatigue" is kept because it communicates the intent users recognize ("I'm cooked"), but the model is execution-against-plan, not recovery-over-time.

This framing matters because it's simpler, cleaner, and correct enough for a v1 that ships. A real recovery model is a v2 problem worth doing, but it is not the v1 thesis.

## Two theses

### Thesis 1 — Fatigue as a prescription, not a display

The prototype shows fatigue as a colored bar. That's a *display*. Flexion turns fatigue into a **prescription**:

- Each muscle has a **weekly volume target** expressed in stim-adjusted volume units. Defaults come from literature-grounded volume landmarks (MEV / MAV / MRV framing from evidence-based hypertrophy work), parameterized by goal (strength / hypertrophy / endurance) × experience level (beginner / intermediate / advanced). Users can override per muscle, one screen deep.
- The week is a single instance (Mon 00:00 → Sun 23:59 local). Resetting on Monday is a **feature**, not a bug: the bar measures *this week's execution of the plan*, not cross-day physiological recovery. See the precise definition above and `03-FATIGUE-SYSTEM.md` for the math.
- Every muscle lives in one of three zones:
  - **Under** (< ~85% of target) — "go hit this." Surfaced as a todo.
  - **At** (~85–100% of target) — "done for the week." Stop logging this muscle.
  - **Over** (> 100% of target, hard cap at e.g. 110%) — "stop." Surfaced as a warning. The app refuses to recommend it and flags any session that would push it further.
- The recommender picks today's session by maximizing under-target muscles and vetoing at/over muscles. When *everything* is at-or-above target, the recommender returns a **rest day**, not a contradictory session (see §"The AI personal trainer" below).
- **Skip and modify are first-class inputs.** If a user skips a planned session, the bar reflects that (muscles stay low). If a user modifies a session — substitutes an exercise, drops a set, runs a deload intensity — the bar reflects what they *actually did*, not what was planned. The preset modification library makes this a two-tap operation: see `02-DOMAIN-MODEL.md` for the shape and `05-COMPONENTS.md` for the UX.

This is the entire product story in one mechanic. Everything else — the program builder, the swap engine, the dashboards — is in service of making this loop fast and pleasant.

### The AI personal trainer (product positioning)

Flexion's recommender is a **stand-in for a human personal trainer, deployed when a human trainer is not available**. That sentence is load-bearing and it constrains every design decision downstream:

- **A human trainer is better than any AI.** The long-term vision is a marketplace where real certified trainers build plans that users can subscribe to inside Flexion. The AI exists to fill the gap until a human is in the loop, and to serve users who cannot afford one.
- **The recommender must be explainable.** A good trainer tells you *why* they're giving you this exercise today. Every recommendation Flexion makes ships with a human-readable rationale ("Your quads are at 42% for the week and you have no leg session scheduled; this Romanian deadlift fills the gap without touching your already-cooked hamstrings"). No black boxes.
- **The recommender is deterministic, not an LLM.** A trainer is conservative and consistent. An LLM is creative and unpredictable. v1 uses a deterministic function over the volume state — simple enough that every decision is traceable, auditable, and testable. An LLM-flavored explanation layer may come later, but only on top of math that is already correct.
- **The recommender is conservative.** A real trainer does not push you through a likely injury to hit a volume number. If the state suggests "this muscle is already over," the app sides with the user's body, not with the plan.
- **The recommender is replaceable.** The `Recommender` interface is a first-class boundary in `packages/domain`. When human-authored plans ship, they implement the same interface. The UI never needs to know whether the recommendation came from math or from a person.

Everywhere you see the word "recommender" in this repo, read "AI personal trainer standing in for a human one." It's not a generative AI feature. It's a product promise.

### Thesis 2 — A dashboard the user can rearrange like an iPhone home screen

Flexion's UI is a **widget grid in a sandbox mode**. In normal mode the dashboard is read-only. Toggle sandbox mode and:

- Widgets become draggable (iOS jiggle-mode feel).
- Widgets resize within declared min/max cell ranges. Resizing reveals more or less data.
- Widgets have a **closed form** (the most relevant signal at a glance) and an **open form** (history, breakdowns, secondary signals). Closed/open is a separate axis from grid size.
- The grid engine, drag/drop, resize, layout persistence, and the `WidgetBase` contract live in a **shared package** that Flexion, Atlas, and BudJet will all consume. Eventually self-hosted as an internal npm package. Per-app widgets only own their content/shape/styles — the *behavior* is written once.

The user is building three apps (`staff-engineer-3-app-skills-map.md`). Sandbox mode is the connective tissue.

## Who it's for

The first user is the builder. The shape of the app is informed by what a serious-but-self-coached lifter actually needs: not a program library, not a social feed, not a gamification engine. A working memory for their body across the week, with opinions.

## Automation principle

**Automated by default. Customizable by exception.**

A user who never opens the settings should still get a coherent week: a sensible program, sensible weekly targets, sensible swaps when an exercise isn't available. A user who *wants* to tune everything — change a muscle's target, override the recommender, design a custom mesocycle — has every knob available, but the knobs are tucked away so the default UI stays clean. Customization never makes the app messier for the people who don't use it.

This principle is non-negotiable. It resolves design ties when both options are equally correct (when they aren't, the more correct one wins regardless). Concretely:

| Decision | Automated default | Customization path |
|----------|------------------|--------------------|
| Weekly muscle targets | Computed from goal preset (strength/hypertrophy/endurance) × experience level | Per-muscle override in Settings → Targets, one screen deep |
| Today's session | Recommender picks based on under-target muscles | "Pick another" button on the session card; full manual mode in Settings → Programming |
| Exercise swap when one isn't available | App picks the highest-stim alternative whose weight scales cleanly | Tap "🔄 Alt" to see all alternatives |
| Set logging defaults | Last-session weight × reps prefilled | Editable per-set, of course |
| Dashboard layout | Opinionated default per device class | Sandbox mode (a *deliberate* opt-in toggle, not always-on) |

The pattern: the automated path ships first, the override is reachable in **one tap or one settings screen**, never both. Customization that requires hunting through three menus is a design failure, not a feature.

## Non-goals (for v1)

These are intentionally out of scope. Listing them here so they don't sneak in under the door.

- **No social features.** No friends, no sharing, no leaderboards. Maybe ever.
- **No nutrition or sleep tracking.** Atlas's job, not Flexion's.
- **No live workout video / form check.** Out of scope.
- **No marketplace of programs.** The app *generates* programs; it doesn't host other people's.
- **No cross-week recovery modeling.** This is not a limitation — it's a scope decision that falls out of the plan-execution framing. The bar measures *this week's execution against this week's target*, nothing more. A user who trains Sunday and sees "0% quads" on Monday is seeing the correct answer to the question the bar is asking: "how much of this week's quad plan have you done?" A physiological recovery model *is* a real future feature — v2 may add a separate "readiness" signal on top of the volume-completion signal — but it is not the v1 thesis and it does not belong in the same bar.
- **No multi-user / shared programs.** Single-user, local-first. Sync is a later phase.
- **No native iOS or native Android.** Mobile is Expo (cross-platform), per `staff-engineer-3-app-skills-map.md:104-114`.
- **No Kubernetes, no microservices.** Flexion's deployment footprint is trivial: one Next.js app (Vercel) and one Expo app (EAS). There are no backend services to orchestrate. K8s would be cargo-culted complexity for zero benefit. The skills-map curriculum puts K8s on Atlas (Phase 2 app), which has actual multi-service needs (API + worker + cache). Local dev *may* use Docker Compose for Postgres once the remote persistence adapter exists; until then, IndexedDB on web and SQLite on mobile cover everything.
- **No "AI coach" chat.** The recommender is a deterministic function over the volume-execution state, packaged as an explainable stand-in for a human trainer (see §"The AI personal trainer"). An LLM-flavored explanation layer can come later, but only on top of math that already works, and never as a replacement for a real trainer.
- **No human-trainer marketplace in v1.** It's in the product vision, not in the v1 scope. The `Recommender` interface is designed so that human-authored plans can plug in later without touching the UI, but shipping an actual marketplace involves identity, payments, content review, and trainer vetting — none of which are v1 concerns.

## Success criteria for v1

Flexion v1 is "done" when every line below is true and verifiable. Each criterion names the **measurement** so it can't slide.

1. **Setup speed.** A new user completes program setup in ≤ 5 minutes via the automated path. *Measurement:* timed walkthrough with the builder as test user; recorded in `docs/08-MISTAKES.md` as a baseline so we know if it regresses.
2. **Log latency.** Time from tap-on-"Log set" to data committed in the persistence layer is ≤ 200 ms p95 on web, ≤ 300 ms p95 on mobile. *Measurement:* `performance.now()` instrumentation, asserted in E2E tests in Phase 4+.
3. **Fatigue display.** The dashboard shows each muscle's current zone (under / at / over) within 1 second of the most recent set being logged. *Measurement:* E2E test that logs a set and asserts the bar updates.
4. **Recommender correctness.** Given a fatigue state, the recommender returns a session whose targeted muscles are *all* in the under zone and zero are in the over zone. *Measurement:* unit tests in `packages/domain` covering happy path, edge cases (all muscles at, all over, brand-new user), and adversarial inputs.
5. **One-tap accept.** From the dashboard, the user can accept the recommended session in one tap and the session becomes today's logged-against session. *Measurement:* Playwright E2E test on web; Maestro on mobile.
6. **Sandbox persistence.** A user rearranges/resizes/opens widgets, reloads, and the layout is identical. *Measurement:* Playwright test, on both surfaces.
7. **No code duplication.** `packages/domain` and `packages/sandbox` are imported by both apps; `apps/web` and `apps/mobile` contain zero fatigue logic and zero layout-reducer logic. *Measurement:* `grep -r "calcFatigue\|layoutReducer" apps/` returns nothing in CI.
8. **Domain coverage.** `packages/domain` has ≥ 90% **branch** coverage (not just line). *Measurement:* `c8` configured in `packages/domain/package.json`, gated in CI starting Phase 1.
9. **Sandbox coverage.** `packages/sandbox` reducer has ≥ 90% branch coverage; platform bindings have smoke + interaction tests on drag, resize, and open/close. *Measurement:* same as #8.
10. **Lighthouse.** Web app scores ≥ 95 across all four axes (Performance, Accessibility, Best Practices, SEO). *Measurement:* Lighthouse CI gate, starting Phase 3.
11. **Accessibility.** Every item in `docs/09-ACCESSIBILITY-CHECKLIST.md` (to be written alongside `06-SANDBOX-MODE.md`) is passing. Sandbox-mode drag/drop has a working keyboard path that screen readers announce.
12. **Mistakes log.** `docs/08-MISTAKES.md` has at least three real entries by v1, each with a concrete "rule for next time" — proving the feedback loop is operating, not just installed.

## What this doc anchors

Everything downstream defers to this file:

- `01-ARCHITECTURE.md` justifies stack choices against these theses.
- `02-DOMAIN-MODEL.md` makes the fatigue prescription representable in types.
- `03-FATIGUE-SYSTEM.md` is the formal spec of Thesis 1.
- `06-SANDBOX-MODE.md` is the formal spec of Thesis 2.
- `07-ITERATION-PLAN.md` sequences the work so the theses ship before the polish.

If any later doc contradicts this one, this one wins until the contradiction is resolved here first.
