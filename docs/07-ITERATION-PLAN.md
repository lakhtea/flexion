# 07 — Iteration Plan

> "Ship a working vertical slice, then widen. Each phase delivers a usable increment." — life-dashboard principle, adopted here.
>
> Read `00-VISION.md` for success criteria that gate v1. Each phase's **exit criteria** are the specific subset of those criteria that must be true before starting the next phase.

## Build order (phases 0–6)

### Phase 0 — Scaffold & Tooling (1–2 days)

**Goal:** a monorepo that builds, lints, type-checks, and tests on CI with zero domain code.

**Tasks:**
- Create `packages/domain/` with `package.json`, `tsconfig.json` (extends `@repo/typescript-config/base.json`), Vitest config, and a single passing test (`describe('scaffold', () => { it('runs', () => expect(true).toBe(true)); })`).
- Create `packages/sandbox/` with the same scaffold, standalone `tsconfig.json` and ESLint config (the extraction-readiness enforcement from `01-ARCHITECTURE.md`).
- Add `@repo/domain` and `@repo/sandbox` as workspace dependencies of `apps/web` and `apps/mobile`.
- Configure `c8` in both packages with the coverage thresholds from `01-ARCHITECTURE.md`: ≥90% branch on domain, ≥90% branch on sandbox reducer, ≥75% on sandbox web bindings.
- Add `eslint-plugin-no-console` to `@repo/eslint-config` and verify it fails on `console.log` in `packages/**` and `apps/**`.
- Configure Zod (`^3.23.0`) as a dependency of `packages/domain`.
- Add `turbo.json` pipeline entries for `lint`, `check-types`, `test`, `test:coverage`.
- Verify `npm run lint && npm run check-types && npm run test` passes across the entire workspace.
- Seed `packages/domain/src/observability/logger.ts` with the `Logger` interface (the contract, not the impl).

**Exit criteria:**
- `npm run lint` passes workspace-wide.
- `npm run check-types` passes workspace-wide.
- `npm run test` passes with ≥1 test per package.
- `eslint-plugin-no-console` rejects a `console.log` in a test file (manual verification).
- CI (GitHub Actions or local `turbo run check-types lint test`) green.

---

### Phase 1 — Domain Package: Types, Fatigue, Recommender (1–2 weeks)

**Goal:** `packages/domain` contains the full v1 type system, the fatigue calculator, and the recommender — all tested to ≥90% branch coverage, all matching the specs in `02-DOMAIN-MODEL.md` and `03-FATIGUE-SYSTEM.md`.

**Tasks:**
- Implement all Zod schemas from `02-DOMAIN-MODEL.md`:
  - `MuscleGroup`, `Exercise`, `ExerciseAlternative`, `MuscleTargets`
  - `WeekTemplate`, `DayTemplate`, `PlannedBlock`, `PlannedExercise`, `PlannedSet`
  - `Session`, `LoggedBlock`, `LoggedExercise`, `LoggedSet` (with `outcome: completed | dropped`)
  - `Skip`, `Modification`, `ModificationPreset`, `SkipPreset`
  - `Layout`, `WidgetPlacement`
- Implement all Zod refinements called out in 02 (7-day keys, skip xor loggedBlocks, weight+bw, stimMap zero rejection, etc.).
- Seed data files: `muscle-target-defaults.ts`, `exercise-library.ts` (port + audit prototype's LIB), `exercise-alternatives.ts` (port prototype's ALTS), `modification-presets.ts`, `skip-presets.ts`.
- Implement `calcFatigue` per `03-FATIGUE-SYSTEM.md`:
  - Three volume branches (reps-with-weight, time, reps-only).
  - Note-set → zero + warning.
  - RPE null → zero + warning.
  - Unknown exercise → zero + warning.
  - Muscle distribution via stimMap.
  - Zone classification (under / at / over / unset).
  - Boundary-pinning tests for 0.85, 1.00, 1.10 thresholds.
  - Worked examples 1–4 from the doc as literal test cases.
  - Purity test (same inputs → deep-equal output).
  - Performance test (<5ms for a 7-day week with 30 sessions).
- Implement `Recommender` (v1 deterministic algorithm):
  - Top-K under-target muscle selection.
  - Template scoring with per-exercise scoring.
  - All-vetoed fallback → rest-day.
  - Time-budget abbreviation with exercise dropping.
  - Rationale generation with structured signals.
  - Determinism test (same state → same recommendation).
- Implement `PersistenceAdapter` interface.
- Implement `calcPrs` (Epley 1RM estimation, cited).
- Implement the `Logger` interface and a test-double impl.
- All 14 test invariants from 02 + all 14 from 03 pass.

**Exit criteria:**
- `packages/domain` has ≥90% branch coverage (enforced by c8 in CI).
- Every worked example in `03-FATIGUE-SYSTEM.md` has a passing test.
- Every schema invariant in `02-DOMAIN-MODEL.md` has a passing test.
- `calcFatigue` performance test passes (<5ms).
- Recommender returns rest-day when all muscles are at-or-over (test passes).
- Zero `any` in `packages/domain/src/` (enforced by `@typescript-eslint/no-explicit-any` in lint config).

---

### Phase 2 — Sandbox Package: Reducer, Grid, dnd-kit (1–2 weeks)

**Goal:** `packages/sandbox` contains the layout reducer, the web grid component (dnd-kit), the `WidgetBase` contract, the registry, and the `usePersistentConfig` hook — all tested.

**Tasks:**
- Implement the layout reducer per `06-SANDBOX-MODE.md`:
  - All actions: toggle-editing, add-widget, remove-widget, move, resize, toggle-open, reorder, reset-to-default, hydrate.
  - Invariant enforcement: no overlap, respect min/max, respect grid bounds, stable placementIds.
  - `gridCols` as a function argument (derived, not stored).
  - Rejection events for invalid actions (logged, not thrown).
- Implement down-projection algorithm (the full row-fill pack from 06).
- Implement `WidgetSpec`, `WidgetRenderProps`, `WidgetRegistry` types and `createRegistry()`. **These live in `packages/sandbox` from Phase 2 onward** so that Phase 3 can import them directly. The Phase 6 extraction is about lifting the *package location* out of the flexion monorepo, not about creating the types — they already exist.
- Implement `usePersistentConfig` hook with Zod validation + fallback.
- Implement web grid component (`packages/sandbox/src/web/SandboxGrid.tsx`):
  - dnd-kit `DndContext` with pointer + keyboard sensors.
  - Custom `keyboardCoordinateGetter` for cell-based arrow-key movement.
  - `DragOverlay` with dashed-outline ghost (not full content).
  - Grid-aware collision detection.
  - Resize handles with Cmd/Ctrl+Arrow.
  - CSS Grid layout: 12/8/4 columns per breakpoint, 56px rows, 12px gap.
- Implement add-widget palette component.
- Implement sandbox-mode toggle component.
- Implement open/close toggle on widget chrome.
- All 8 reducer invariant tests + all 8 sandbox test invariants from 06 pass.
- Sandbox isolation test: `npm run --filter @repo/sandbox test` passes with no other packages built.

**Exit criteria:**
- Layout reducer has ≥90% branch coverage.
- Sandbox web bindings have ≥75% branch coverage.
- The sandbox isolation invariant passes (no imports from flexion-specific packages).
- A test renders a grid with 3 widgets, drags one via keyboard, and asserts the reducer state changed.
- **Registry integration test:** a test creates a registry with 3 real widget specs (stub components), mounts a grid, and renders all 3 without crashing. Validates that the registry → grid → widget pipeline works end-to-end before Phase 3 depends on it.
- axe-core passes on a mounted grid in edit mode.
- ESLint `no-restricted-imports` rule fails if someone adds a flexion import to sandbox.

---

### Phase 3a — Web App: Core Widgets + Persistence (2–3 weeks)

**Goal:** `apps/web` renders a working dashboard with the **7 highest-priority widgets** (the prescription + execution core), backed by Dexie for persistence. Lighthouse ≥85 on Performance (full ≥95 deferred to Phase 5).

**Tasks:**
- Wire Zustand stores: domain store (sessions, targets, preferences) and layout store (placements, editing toggle).
- Implement Dexie `PersistenceAdapter` (the `IndexedDBAdapter`).
- Run the adapter conformance test suite against it.
- Implement Dexie migrations (v1 schema from `02-DOMAIN-MODEL.md`).
- Seed data loader: exercise library, alternatives, modification presets, skip presets, default WeekTemplates (3 presets: PPL 6-day, Upper/Lower 4-day, Full Body 3-day).
- Implement the **7 core widgets** (Phase 3a scope):
  1. `TodaysSessionCard` — the headline widget
  2. `SessionLogger` — the set-logging surface
  3. `FatigueHeatmap` — SVG body diagram (simplified silhouette for v1; polish in Phase 5)
  4. `WeekOverview` — 7 day-cards
  5. `RecommendationCard` — recommender output + rationale
  6. `MissedSessionNudge` — "Let us know how your squats went"
  7. `QuickStats` — sets this week, streak
  - Each widget: closed form + open form (where applicable) + config schema.
  - Session Logger: full set-logging UI with swap/modify/skip flows.
- Wire widgets into a `WidgetRegistry` via `createRegistry()`.
- Build the program-setup onboarding flow (choose goal → choose experience → choose split → dashboard appears with defaults).
- Widget smoke tests: each core widget renders at minSize/defaultSize/maxSize without crashing, passes axe-core.
- Lighthouse ≥85 on Performance; ≥95 on Accessibility, Best Practices, SEO. (Full ≥95 across all four axes deferred to Phase 5, after lazy-loading and virtualization.)
- Sentry integration: init in root layout, source maps uploaded.
- `pino` logger wired to the domain `Logger` interface.
- Lazy-load widget components below the fold using dynamic imports (needed for Lighthouse ≥85).

**Exit criteria (Phase 3a):**
- A new user can complete the program-setup flow in ≤5 minutes (timed dogfood).
- Logging a set updates the fatigue bars in <200ms (measured by `performance.now()` in a Playwright test).
- Dashboard layout persists across page reloads (Playwright test: rearrange → reload → assert same positions).
- Lighthouse ≥85 Performance, ≥95 Accessibility/Best Practices/SEO.
- Sentry receives a test error in the staging environment.
- All 7 core widgets pass axe-core at default size.
- Dexie adapter conformance suite passes.
- No `console.log` in committed code (lint gate).

---

### Phase 3b — Remaining Widgets + Chart Library (1–2 weeks)

**Goal:** the remaining 7 widgets ship, including the chart-dependent ones. Chart library decision is resolved.

**Tasks:**
- Chart library spike (day 1): evaluate Recharts (a11y story) vs lightweight alternatives. Decision documented in `01-ARCHITECTURE.md`.
- Implement remaining 7 widgets:
  8. `WeeklyVolumeBar` — single-muscle bar with sparkline (needs chart lib)
  9. `MuscleRadar` — radial chart (needs chart lib)
  10. `VolumeTrend` — line chart over weeks (needs chart lib)
  11. `ProgramCard` — current split reference
  12. `PRTracker` — personal records with Epley 1RM
  13. `RoutineShortcut` — launch a saved routine
  14. `ModificationHistory` — recent skips/modifications timeline
- Widget smoke tests for all 7.

**Exit criteria (Phase 3b):**
- All 14 widgets render at minSize/defaultSize/maxSize without crashing.
- All 14 pass axe-core.
- Chart library is decided and documented.

---

### Phase 4 — Mobile App: Expo + Shared Domain (2–3 weeks)

**Goal:** `apps/mobile` renders the same dashboard, driven by the same domain package, with native gesture bindings for sandbox mode. Web leads; mobile is feature-equal except for chart library (may differ).

**Tasks:**
- Wire `packages/domain` into `apps/mobile` (should be zero changes to domain — if not, that's a mistake and gets logged in 08).
- Implement `SQLiteAdapter` (expo-sqlite) for the `PersistenceAdapter` interface. Run the conformance suite.
- Implement native sandbox bindings (`packages/sandbox/src/native/`):
  - Sequential Gesture.LongPress → Gesture.Pan with `runOnJS` dispatch.
  - Resize handles.
  - Reduced Motion respect.
  - `accessibilityActions` for VoiceOver drag.
- Implement all 14 widgets in React Native:
  - Widgets reuse the same `WidgetSpec` files from web (shared specs, platform-split components).
  - Chart library decision for native (spike: victory-native vs react-native-skia charts).
  - SVG body diagram for Heatmap (react-native-svg).
- Test: log a set on mobile → fatigue updates (manual + Maestro flow).
- Test: rearrange dashboard on mobile → layout persists across app kill.

**Exit criteria:**
- `packages/domain` required zero changes for mobile integration (or any changes are logged in 08-MISTAKES.md with a fix that restores platform-agnosticism).
- SQLite adapter conformance suite passes.
- Logging a set on mobile takes <300ms (measured by timer in Maestro flow).
- Sandbox drag and resize work with VoiceOver enabled (manual test).

---

### Phase 5 — Polish, E2E, Observability (1–2 weeks)

**Goal:** the app is shippable. Critical flows are E2E-tested. Observability is real.

**Tasks:**
- Playwright E2E suite (web): log a set, accept recommendation, sandbox rearrange + reload, skip a session, backfill a missed session.
- Maestro E2E suite (mobile): same critical flows.
- Sentry production config: 100% error sample, 10% performance traces, GDPR mode.
- Structured logging audit: verify every domain event has a logger call with the schema from `01-ARCHITECTURE.md`.
- Time-to-log-a-set metric: instrument and assert ≤200ms p95 in E2E.
- Visual polish pass on widget chrome, sandbox jiggle animation, fatigue bar transitions.
- Accessibility audit: manual VoiceOver pass on web + mobile. Fix findings.
- `docs/09-ACCESSIBILITY-CHECKLIST.md`: create the per-PR gate checklist, all items passing.
- Dogfood: use the app for one full training week. Log everything in `08-MISTAKES.md`.

**Exit criteria:**
- All Playwright and Maestro E2E tests pass.
- Lighthouse ≥95 (still).
- Every success criterion in `00-VISION.md` is met and verified.
- `docs/08-MISTAKES.md` has ≥3 real entries.
- The builder can set up a program in <5 minutes and log a full session without hitting a bug.

---

### Phase 6+ — Future (not scheduled)

These are named so they don't sneak into earlier phases.

| Feature | Phase | Depends on |
|---------|-------|------------|
| Remote persistence (Supabase) | 6 | Phase 3 adapter interface |
| Cross-device sync | 6 | Supabase + conflict resolution |
| Program / Mesocycle / Microcycle builder | 7 | Phase 1 domain types (sketched) |
| Physiological readiness signal (v2 fatigue) | 7 | Real usage data from Phase 5 dogfood |
| LLM-flavored rationale layer on top of recommender | 7 | Phase 1 recommender determinism (must stay correct underneath) |
| Human-trainer marketplace | 8+ | Identity, payments, vetting — not an engineering problem first |
| Sandbox package extraction to `~/workspace/packages/sandbox` | 6 | Atlas adopts the shared package |
| Atlas config migration (Zod schemas for 40 widgets) | 6 | Sandbox package extracted |
| WidgetSpec enhancements (empty/error/loading state fields) | 6 | V1 dogfood reveals which states matter |
| Recalibration of TIME_COEFF and REPS_ONLY_COEFF | 7 | Real user data |
| Inter-muscle balance constraints in recommender (push/pull) | 7 | Phase 5 dogfood |
| Widget search in add-widget palette | 7 | Widget count exceeds 30 |

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| dnd-kit keyboard sensor requires more custom code than expected | Medium | Medium | Budget 2 extra days in Phase 2. If it spirals, ship pointer-only first and add keyboard in a patch (atlas's approach, documented in 06-SANDBOX-MODE.md). |
| Fatigue numbers feel "wrong" after first real training week | High | Medium | The v1 coefficients are hand-tuned. Budget dogfood time in Phase 5 to recalibrate TIME_COEFF and REPS_ONLY_COEFF. The architecture supports constant changes without schema migrations. |
| Expo + Reanimated 4 gesture composition has undocumented edge cases | Medium | High | Spike gesture composition early in Phase 4 (first day). If it's broken, fall back to a simpler drag model (no long-press gate, just sandbox-mode gating). |
| Lighthouse ≥95 is hard with a heavy widget grid | Medium | Medium | Phase 3a targets ≥85 Performance with lazy-loaded widgets. Phase 5 adds virtualization and targets ≥95 across all axes. Profiling is budgeted as a Phase 5 task. |
| Multiple debounced writers (domain + layout stores) may race | Low | Medium | Integration test in Phase 3a: change a widget position and log a set within 100ms; assert both persist correctly. Budget 1 day for store-sync investigation if the test fails. |
| Dexie migrations break on iOS Safari private browsing | Low | High | Test in Safari private mode explicitly. If IndexedDB is unavailable, fall back to in-memory store with a warning. |
| Builder burnout from too many phases before shipping | Medium | High | Phase 3 is the first "usable" milestone. If Phase 1+2 take longer than 4 weeks total, re-evaluate scope and cut the least-important 4 widgets from the v1 catalog. |

---

## Scope management

- **Strict MVP per phase.** Each phase has exit criteria. If a nice-to-have threatens the exit criteria's timeline, it goes to the backlog.
- **Backlog lives here.** The Phase 6+ table is the backlog. Items are added at the bottom; they're not prioritized until the preceding phase ships.
- **"Can we just add X?" test:** if X isn't in the current phase's task list, the answer is "add it to Phase 6+ and revisit after this phase ships." The only exception is a bug that blocks exit criteria.
- **Phase boundaries are hard gates.** A phase is "done" when its exit criteria pass, not when its task list is empty. If a task is undone but the exit criteria pass, the task was optional and moves to the backlog.
