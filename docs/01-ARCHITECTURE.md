# 01 — Architecture

> Read `00-VISION.md` first. This doc justifies every stack choice against the two theses there. If a choice can't be defended in those terms, it doesn't belong here.

## Problem decomposition

Flexion has to do five things, and the architecture is organized around them:

1. **Represent a training week** in a strict, typed model that web and mobile share.
2. **Compute the fatigue prescription** (per-muscle weekly target % zone) from logged sets. Pure math, no I/O. Has to run identically on web and mobile.
3. **Persist** the week (local-first), with a swappable adapter so we can add a remote backend without rewriting domain code.
4. **Render a sandbox-mode widget grid** that's drag/drop/resize, with closed/open widget states, on both web (DOM) and mobile (RN). Drive both platforms from the same layout reducer.
5. **Recommend** today's session based on the fatigue prescription. Deterministic function, not an LLM.

Each of these maps to a specific package (below). The boundary cuts are picked so that the *expensive things to get right* (fatigue math, layout reducer, persistence interface) live in places where both apps consume them and tests pin them down.

## High-level layout

```
apps/flexion/
├── apps/
│   ├── web/                Next.js (App Router). Thin. Imports domain + sandbox + ui.
│   └── mobile/             Expo Router. Thin. Imports domain + sandbox + ui.
├── packages/
│   ├── domain/             Pure TS. Types, fatigue calc, recommender, persistence interface,
│   │                       layout reducer. NO React, NO DOM, NO RN. Vitest.
│   ├── sandbox/            The shared sandbox-mode engine. Built ON TOP of domain's layout
│   │                       reducer. Provides WidgetBase contract + platform-split renderers
│   │                       (web uses dnd-kit, native uses reanimated+gesture-handler).
│   │                       Designed as if it were already an external npm package.
│   ├── ui/                 Cross-platform-aware primitives (currently web-only; will gain
│   │                       platform-split files as needed).
│   ├── eslint-config/      Existing.
│   └── typescript-config/  Existing. base/nextjs/expo presets — see this dir's README.
└── docs/                   This dir. The plan IS the artifact (per CLAUDE.md Rule #1).
```

### Why this split

| Boundary | Why it exists |
|----------|---------------|
| `domain` is framework-free | Lets us run the fatigue calculator under Vitest in milliseconds, share it byte-for-byte with mobile, and prove correctness once instead of twice. |
| `sandbox` is separate from `domain` | The layout reducer is *domain* (pure state transitions). The drag/drop *bindings* are platform code. Splitting them lets domain stay testable in Node, and lets sandbox have a clean public API ready for extraction. |
| `sandbox` is separate from `ui` | UI is generic primitives (button, text, card). Sandbox is one specific subsystem (the grid). Mixing them would couple every app's button library to the grid engine, which is wrong. |
| `apps/*` are thin | If a piece of logic lives in `apps/web/src/lib/`, it's a smell — it probably belongs in `domain` (so mobile gets it too) or `ui` (so it's reusable). |

### Sandbox package: extraction-ready, not extracted yet

The user explicitly wants the sandbox to be reusable across Flexion, Atlas, and BudJet — eventually as a self-hosted npm package. **Today** it lives at `apps/flexion/packages/sandbox` because BudJet doesn't exist yet and Atlas is already shipping a production-quality v0 of its own grid engine (see §"Atlas as the reference consumer" below). **Tomorrow** it lifts out unchanged to `~/workspace/packages/sandbox` (or a private registry) and Atlas migrates to depend on it.

The discipline that makes this lift cheap, with a real enforcement mechanism — not vibes:

1. **Zero Flexion imports.** `packages/sandbox/src/` imports nothing from `apps/web`, `apps/mobile`, or any other Flexion package except `@repo/typescript-config` (build-time only). Enforced by an ESLint rule: `no-restricted-imports` configured in `packages/sandbox/.eslintrc.cjs` to forbid `apps/*` and any non-allowlisted `@repo/*`. CI fails if violated.
2. **Standalone tsconfig.** `packages/sandbox/tsconfig.json` extends `@repo/typescript-config/base.json` *only*. It does not pull in `nextjs.json` or `expo.json`. Anything that breaks under base alone is a leak.
3. **Self-contained tests.** `pnpm --filter @repo/sandbox test` (or the npm equivalent) must pass with no other workspace package built. CI enforces this with a job that runs sandbox tests in isolation.
4. **Public API in `exports`.** `packages/sandbox/package.json` declares its public surface explicitly in the `exports` field. Anything not exported is internal. Renaming an internal symbol is not a breaking change.
5. **Own README, own changelog.** Like a real published package. When the time comes to extract, all the metadata is already there.
6. **Per-app widgets stay in apps.** Sandbox provides the `WidgetBase` contract and the grid engine; concrete widgets (FatigueHeatmap, NextLiftCard, etc.) live in `apps/web/widgets/` and `apps/mobile/widgets/`. Sandbox knows nothing about fatigue.

If a PR breaks any of (1)–(4), CI rejects it. The lift-out story isn't a hope — it's a CI invariant.

### Atlas as the reference consumer

Atlas (the second app in the user's three-app sequence) already has a working sandbox grid and widget registry — investigated in detail by a research subagent and reported inline in the session. Key facts that shape flexion's design:

- Atlas's grid uses a **custom pointer-event implementation** (no dnd-kit), with a ghost element during drag, AABB collision detection, and a 12-column CSS grid with 56px rows and 12px gaps. It's ~120 lines, it works, it's been used in production-shape code.
- Atlas explicitly defers accessibility: "Phase 1 doesn't need accessible keyboard drag; the priority is shipping the shape. A11y drag ships in Phase 2 and will probably move us to dnd-kit then" (from atlas's own `docs/01-ARCHITECTURE.md`).
- Atlas mixes its layout state with its domain state in a single Zustand snapshot (`AtlasSnapshot` contains both `items` and `layouts`). This is explicitly *not* the pattern flexion will follow — see §"State" above.
- Atlas has a flat widget registry (a static array in `registry.ts`) with 40 widgets, no per-widget min/max size declarations (hardcoded to 2×2 min), and no open/closed widget-state axis.

**The decision this forces and the justification:** flexion uses **dnd-kit** for web (not a custom pointer implementation), even though atlas has a working pointer implementation we could lift. Reasons, with alternatives named:

1. **Accessibility is a CLAUDE.md hard rule.** dnd-kit ships keyboard sensors and screen reader announcements for free. A custom pointer impl doesn't. Accepting the atlas pattern would mean regressing on an explicit quality bar.
2. **Atlas itself was planning to migrate** — the pointer-events approach was documented as a Phase 1 shortcut, not the long-term shape. Flexion shipping a dnd-kit-based shared package is the vehicle that gets atlas to its own Phase 2.
3. **The atlas patterns worth lifting are library-independent.** The ghost-element UX, AABB collision detection, `usePersistentConfig` hook, `PersistenceAdapter` interface, layout reset, and selector discipline all work equally well under dnd-kit. We lift those. We do not lift the pointer math.
4. **Rejected alternative: two engines behind one interface.** Supporting both pointer events and dnd-kit in the same package to avoid forcing atlas to migrate would double the test surface and hide bugs in the unused engine. Not worth it for a future migration atlas was already planning.

`06-SANDBOX-MODE.md` is the authoritative spec; this section only records the load-bearing decision.

## Stack choices (each one defended)

### Web — Next.js (latest, App Router)

- **Why:** already in place; the user wants to learn the modern Next idioms; App Router gives us RSC for shells and client components for the interactive grid.
- **Watch out:** `apps/web/AGENTS.md` says "This is NOT the Next.js you know." Read `node_modules/next/dist/docs/` before writing Next-specific code. The training data is stale.

### Mobile — Expo Router

- **Why:** skills map says Flexion is the *cross-platform* mobile app. Expo + Expo Router gets us file-based routing on RN and a clean dev loop. Native iOS/Android are reserved for Atlas/BudJet.
- **Watch out:** Reanimated v4 + worklets v0.5 are already pinned in `apps/mobile/package.json`. Reanimated 4 changed enough that pre-v3 code patterns are wrong; check the Reanimated docs before writing gesture code.

### Domain — Pure TypeScript + Vitest

- **Why:** Domain logic must be platform-agnostic. Pure TS means it runs in Node tests, in Next server components, in RN, and in any future workers. Vitest is the fastest test runner with native ESM and matches the rest of the modern TS stack.
- **No React, no DOM types, no RN types.** The `@repo/typescript-config/base.json` preset already excludes DOM. If domain accidentally imports `react`, the build fails.

### State — Zustand (decided) + derived state (large)

**Decision: Zustand.** Not `useReducer + Context`. Reasons, with the alternative explicit:

- We need **memoizable selectors with shallow equality** (`useShallow`) so widgets don't rerender when an unrelated slice of the store changes. `useReducer + Context` has no equivalent — every consumer rerenders on every dispatch.
- We need **subscriptions from non-React code** (the persistence write-through layer, the logger, future analytics). Zustand exposes `store.subscribe()`. `useReducer` is React-only.
- We need **identical APIs on web and mobile**. Zustand works in both byte-for-byte. Context-based patterns differ subtly between Next App Router (RSC boundaries) and RN.
- The cost is one small dependency (~1 KB gzipped). Acceptable.

This decision is closed. Revisiting it requires updating this section *and* `docs/08-MISTAKES.md` with what changed.

**Why mostly derived state:** the fatigue prescription is a *function* of the logged sets and the targets. It is not stored. Storing it would create staleness bugs the moment the formula changes. We compute on read, memoize aggressively (selector-level + a `useMemo` per consumer).

**What's in the store:**

- The current week's session log (the only mutable thing the user touches frequently).
- User preferences: muscle targets, layout snapshot, sandbox-mode toggle, theme.
- Persistence status flags (last write timestamp, dirty bit).

That's it. Everything else — fatigue percentages, recommendations, derived dashboard counts — is computed on read.

### Validation — Zod

- **Why:** every value crossing a boundary (persistence layer, future API, user input forms) gets a Zod schema. Zod gives us runtime validation *and* a derived static type, so the schema is the single source of truth. No drift between "what the type says" and "what we actually got."
- **Where it doesn't apply:** values that never cross a boundary. Don't Zod-wrap your local variables.

### Persistence — `PersistenceAdapter` interface, local-first

Per the user's chosen Option C from the planning round: design the persistence boundary as an interface from day one, ship a local adapter first, swap in remote later without touching domain code.

```ts
// packages/domain/src/persistence/adapter.ts (sketch — not yet implemented)
export interface PersistenceAdapter {
  getProgram(id: ProgramId): Promise<Program | null>;
  saveProgram(p: Program): Promise<void>;
  getCurrentWeek(programId: ProgramId): Promise<Week>;
  saveSession(s: Session): Promise<void>;
  getLayout(userId: UserId, surface: 'dashboard'): Promise<LayoutSnapshot | null>;
  saveLayout(userId: UserId, surface: 'dashboard', layout: LayoutSnapshot): Promise<void>;
  // ...
}
```

| Adapter | Backend | Phase |
|---------|---------|-------|
| `IndexedDBAdapter` (web) | **Dexie** (decided — see below) | Phase 2 |
| `SQLiteAdapter` (mobile) | `expo-sqlite` | Phase 4 |
| `RemoteAdapter` (later) | Supabase (matches life-dashboard, free tier sufficient, gives us auth + RLS + realtime in one) | Phase 6+ |

**Why Dexie over `idb-keyval`:** the access patterns are not key-value. We need *queries*: "all sessions for week W", "all sessions targeting muscle M", "latest weight logged for exercise E". Dexie gives us secondary indexes and a typed query builder for ~24 KB gzipped. `idb-keyval` would force us to re-implement indexes by hand and would lose query performance the moment weeks accumulate. The 24 KB is worth it.

The adapter *interface* is still the contract; Dexie is the v1 implementation. If a remote backend ships in Phase 6, the local adapter remains as the offline cache.

**Persistence boundary tests:** every adapter must pass the same `PersistenceAdapter` conformance test suite that lives in `packages/domain/test/adapter-conformance.ts`. This is how we prove behavioral equivalence across web and mobile, and how we prevent the domain layer from leaking adapter-specific assumptions.

### Logging & error tracking

- **Why now (even on a small app):** skills map (line 146) explicitly puts structured logging + error tracking on Flexion's quality bar. CLAUDE.md echoes this.
- **The contract first:** `packages/domain/src/observability/logger.ts` exports a tiny `Logger` interface (`debug | info | warn | error`, all taking `(event: string, payload?: Record<string, unknown>)`). Domain code only ever sees this interface; the implementation is injected by each app.
- **Structured log schema** (every log entry, every level):
  ```ts
  { ts: string; level: 'debug'|'info'|'warn'|'error'; event: string;
    surface: 'web'|'mobile'; sessionId?: string; userId?: string;
    payload?: Record<string, unknown>; err?: { name; message; stack } }
  ```
  No free-form strings. `event` is a stable kebab-case key (e.g., `set-logged`, `recommender-failed`) so dashboards and queries are stable.
- **Web implementation:** `pino` with the browser config. Ships logs to Sentry's logging endpoint in production; pretty-prints in dev.
- **Mobile implementation:** thin custom impl that calls `console` in dev and pipes to Sentry's RN SDK in prod. Same `Logger` interface.
- **Error tracking:** Sentry on both surfaces. Privacy posture: no request bodies, no user input echoed into payloads, GDPR mode on. 100% sample for errors, 10% for performance traces. Source maps uploaded as part of the build (Next plugin / EAS).
- **Rule enforcement:** `eslint-plugin-no-console` configured to fail on `console.*` in `apps/**` and `packages/**` (test files exempted). No `console.log` in committed code, period.

### Testing strategy

| Layer | Tool | Coverage target | Rationale |
|-------|------|-----------------|-----------|
| `domain` (pure logic — fatigue, recommender, layout reducer, persistence interface) | Vitest | ≥ 90% **branch** | The crown jewel. Every formula in `03-FATIGUE-SYSTEM.md` is pinned by a test. Branch (not line) coverage so unhandled `else` paths actually fail. |
| `sandbox` (layout reducer) | Vitest | ≥ 90% branch | Pure reducer; same bar as domain. Lives in domain dependencies, runs in Node. |
| `sandbox` (web bindings — dnd-kit drag/drop/resize) | Vitest + Testing Library + `@testing-library/user-event` | ≥ 75% branch | Core interaction. A regression here is a product failure. Tests cover drag start/move/end, resize handles, keyboard nav, open/close. |
| `sandbox` (native bindings — reanimated/gesture-handler) | Jest (RN preset) + RNTL | ≥ 60% branch (gesture mocking is hard) | Smoke + reducer integration. Real gesture replay deferred to E2E. |
| `apps/web` widget content | RTL + Vitest | ≥ 30% lines, snapshot OK | Glue: render with mock data, assert headline values appear. |
| `apps/web` glue (routes, layouts, providers) | RTL | smoke tests only | Types catch most bugs here. |
| `apps/web` end-to-end | Playwright | Critical flows only — log a set, accept recommendation, sandbox rearrange + reload | Phase 4+. Gates the success criteria in `00-VISION.md`. |
| `apps/mobile` end-to-end | Maestro | Same critical flows on real RN | Phase 5+. |

The split mirrors the skills map: high coverage on domain logic, real coverage on the *one* interactive subsystem that breaking would silently destroy (the sandbox grid), light coverage on widget content. UI glue gets types-only.

**Coverage enforcement:** `c8` configured per package; `npm run test:coverage` runs in CI and fails the build if any package drops below its target. The CI configuration itself is built in **Phase 1** of `07-ITERATION-PLAN.md` — this doc commits to the targets, the iteration plan owns when the gate goes live.

## Data flow (single source of truth)

```
                        ┌─────────────────────────────┐
                        │   User action (web or RN)   │
                        └────────────┬────────────────┘
                                     │
                                     ▼
                  ┌──────────────────────────────────┐
                  │  Zustand store action            │
                  │  (small: log set, toggle widget) │
                  └────────────┬─────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────────┐
              │  Pure domain function              │
              │  (calcFatigue, recommendSession,   │
              │   layoutReducer)                   │
              └────────────┬───────────────────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │  Persistence adapter         │
            │  (write-through, async)      │
            └────────────┬─────────────────┘
                         │
                         ▼
          ┌──────────────────────────────────┐
          │  Local store (IndexedDB/SQLite)  │
          └──────────────────────────────────┘
```

Reads bypass the store entirely when they're cheap and pure: components call `useFatigue()` which calls `calcFatigue(week, targets)` directly with memoization. The store is only for things that need to broadcast change.

## Performance strategy

| Concern | Strategy |
|---------|----------|
| Fatigue recompute on every keystroke (the prototype's sin — see `08-MISTAKES.md` 2026-04-09) | Memoize on `(week, targets)` reference identity. Mutate via Immer drafts, not deep-clone. Target: <5ms per recompute for a 7-day week with 30 sets, asserted in a Vitest perf test. |
| Widget grid rerenders during drag | Layout reducer is the only source of truth; widgets read their own slot via a selector and only rerender when *their* slot changes. |
| Initial bundle size on web | RSC for the shell. Widgets are dynamically imported per slot. |
| Mobile cold start | Hermes is on by default in Expo; keep the domain package small (no lodash, no moment). |
| Persistence write storms | Debounce writes per entity; the persistence adapter has a `flush()` for app backgrounding. |

## Accessibility strategy

The prototype uses color as the only signal (red bar = bad). That fails. The rebuild's checklist (this is the actual checklist — `docs/09-ACCESSIBILITY-CHECKLIST.md` will reproduce it as a per-PR gate when sandbox mode lands):

- [ ] **WCAG 2.1 AA** is the standard. Not "we'll think about a11y" — we hit AA or it doesn't ship.
- [ ] Color is never the only signal. Every color carries an icon or a text label.
- [ ] All interactive elements are semantic (`<button>`, `<a>`) on web; `accessibilityRole` set on RN.
- [ ] Keyboard path exists for every action that has a mouse/touch path. Including sandbox drag (dnd-kit's keyboard sensor) and sandbox resize (arrow keys + modifier).
- [ ] Visible focus rings, never `outline: none` without a replacement.
- [ ] Screen reader announces meaningful state changes ("widget moved to row 3 column 2", "fatigue zone changed to over").
- [ ] Reduced Motion respected: the iOS-style jiggle in sandbox mode is muted to a static highlight when `prefers-reduced-motion` is set (web) or `AccessibilityInfo.isReduceMotionEnabled()` is true (RN).
- [ ] Dynamic Type respected on mobile.
- [ ] Tested with `axe-core` in Playwright (web) and a manual VoiceOver / TalkBack pass (mobile) before each release.

This is in scope for v1, not a polish-pass deferral. Enforcement: axe-core assertions live in the same Playwright suite that gates the success criteria.

## Observability strategy (v1 minimum)

- **Structured logs** with `level`, `event`, and a payload. Never free-form strings.
- **Error tracking** via Sentry on both surfaces. Source maps wired up for web; symbolication for RN.
- **One metric:** time-to-log-a-set (from tap-to-log to persisted). It's the most important UX number; if it regresses, we'll know.
- **No analytics SDKs in v1.** The user is the only user. Add later when there are users to analyze.

## What this doc deliberately leaves to later docs

| Question | Where it gets answered |
|----------|------------------------|
| What are the entities and their schemas? | `02-DOMAIN-MODEL.md` |
| What's the exact fatigue formula and how do targets work? | `03-FATIGUE-SYSTEM.md` |
| What does the log-a-set flow look like end to end? | `04-FLOWCHARTS.md` |
| Which widgets exist and how are they specified? | `05-COMPONENTS.md` |
| How does the grid math work? | `06-SANDBOX-MODE.md` |
| When does each piece ship? | `07-ITERATION-PLAN.md` |

If you're reading this doc and a question feels unanswered, check whether it's already been pushed to one of the above. If it hasn't, raise it — we should add it somewhere explicitly.

## Open architectural questions (genuinely open — closed ones are not listed)

1. **Where the widget content lives in mobile.** On web it's obvious — JSX in `apps/web/widgets/`. On mobile the question is whether widgets live alongside the route screens (Expo Router file colocation) or in a sibling top-level folder (`apps/mobile/widgets/`) for symmetry with web. Defer to `05-COMPONENTS.md`. This is a structure question, not an architecture question — neither answer is wrong.
2. **How many layouts per user.** Three options: (a) one global layout used everywhere, (b) one per device class (phone vs tablet vs desktop), (c) one per device class per orientation. Tradeoff is UX clarity vs storage shape. Lean is (b) — phone and desktop layouts are independent, but a phone layout doesn't fork into landscape/portrait. Defer to `06-SANDBOX-MODE.md` and decide there.
3. **How the recommender expresses uncertainty.** When no fully-under-target session exists (e.g., everything is at-target), does it return nothing, return the closest acceptable session, or return a "rest day" recommendation? The first is honest, the third is friendlier. Decide in `03-FATIGUE-SYSTEM.md`.

Decisions made *and closed* in this document so far: Zustand (state), Dexie (web persistence), pino + Sentry (observability), Vitest (testing), the package split, the sandbox extraction enforcement mechanism, the testing strategy table. None of these get re-litigated without an entry in `08-MISTAKES.md` explaining what changed.
