# 06 — Sandbox Mode

> Read `00-VISION.md` §"Thesis 2" and `01-ARCHITECTURE.md` §"Sandbox package" and §"Atlas as the reference consumer" before this. This doc is the authoritative spec of the sandbox subsystem that will live in `packages/sandbox` and eventually be extracted as a shared npm package used by Flexion, Atlas, and BudJet.
>
> This doc is also the first package in the repo whose primary consumer is **another app** (Atlas), not Flexion. Decisions here are made with that constraint first, not second.

## What "sandbox mode" is

The dashboard has two modes:

1. **View mode** (default) — the grid is read-only. Widgets display data. Tapping a widget opens its default action (e.g., a session-start button, a modal, a navigation). The grid is a dashboard.
2. **Sandbox mode** (toggle) — the grid is editable. Widgets jiggle. You can drag them, resize them, open/close them, add new ones from a palette, and remove existing ones. Think iOS home-screen edit mode.

Toggling between modes is a single boolean in the layout store (`editing: boolean`). Nothing else. No intermediate states, no per-widget edit toggles, no "are you sure" confirmations.

**Sandbox mode is opt-in on every session.** Exiting the app doesn't persist `editing: true`. You come back tomorrow and the grid is in view mode. The layout you set *does* persist; the edit-mode flag doesn't. This prevents the user from getting stuck in an editable state and accidentally moving things.

## Two axes: size and open/closed

Flexion's widgets have **two independent dimensions of configuration**, and this is the biggest thing that distinguishes flexion's sandbox from atlas's (which only has size).

### Axis 1 — Size

Every widget declares `defaultSize`, `minSize`, `maxSize` in **grid cells** (not pixels). Resizing within the declared range reveals more or less data. The widget is responsible for rendering at every size between min and max — a resize handle is not a license to clip content.

Example: `FatigueHeatmap` is a body diagram.
- `minSize: { w: 2, h: 3 }` — just the torso outline with colored muscles, no labels
- `defaultSize: { w: 3, h: 4 }` — full body, with muscle names on hover
- `maxSize: { w: 5, h: 6 }` — full body, all muscle names visible, per-muscle percentage labels overlaid, legend in a corner

### Axis 2 — Open/closed

Orthogonal to size, every widget has two rendered *forms*: **closed** (the default) and **open**. Closed is "the most important signal at a glance." Open is "more context: history, breakdowns, secondary signals." Both fit within the widget's current grid footprint — **open does not change the widget's size**. The difference is what the widget chooses to show.

Example: `WeeklyVolumeBar` for Quads.
- **Closed**: one bar, "Quads 78% (under)" in the center. Takes any size from 1×1 up.
- **Open**: same header, plus a sparkline of the last 4 weeks of quad volume beneath the bar, plus a small count of how many sets contributed this week. Same footprint, more ink.

A widget that has nothing useful to show in an open form declares `openForm: 'none'` in its spec, and the open/close control is hidden for that widget. The default assumption is widgets *have* an open form; saying "no" is explicit.

### Why both axes?

- **Size** is about screen real estate — "I have room for this, make it bigger."
- **Open/closed** is about depth — "I have a question, show me more than the headline."

They solve different user needs and conflating them (atlas's model) forces widgets to pick whether growing means "bigger text" or "more information." Flexion's split lets the user say both independently. Whether this is worth the extra complexity is a v1 hypothesis; if six weeks in the user is never using open/closed, we delete the axis in a Phase 2 simplification.

## The grid

### Dimensions (copied from atlas, confirmed by the user's "iPhone home screen" mental model)

- **12 columns** on desktop (≥ 1200px viewport)
- **8 columns** on tablet (768–1199px)
- **4 columns** on phone (< 768px)
- **Row height**: 56 px
- **Gap**: 12 px (both between rows and between columns)
- **Auto-rows**, not fixed row count — the grid grows downward as widgets are added.

These numbers are constants in `packages/sandbox/src/grid/constants.ts`. They match atlas's grid exactly so a widget sized for one app is sized for the other.

### Coordinates

Widgets live at integer `(col, row)` coordinates with integer `w` and `h` extents in cells. No fractional cells, no free-pixel positioning. All math is deterministic.

```ts
export interface WidgetPlacement {
  placementId: string;  // unique per INSTANCE, not per widget type (two WeeklyVolumeBars have different ids)
  widgetKey: string;    // widget TYPE key, e.g. 'flexion.weekly-volume-bar'
  col: number;          // 0-based, left edge
  row: number;          // 0-based, top edge
  w: number;            // width in cells, ≥ 1
  h: number;            // height in cells, ≥ 1
  openState: 'closed' | 'open';
  config: Record<string, unknown> | undefined;
}
```

### Per-device layouts (NOT inherited from atlas)

Atlas has one layout per section; mobile and desktop share it, which (per the atlas briefing) causes "squeeze on small screens." Flexion stores layouts per `(userId, surface, deviceClass)` tuple, matching the schema in `02-DOMAIN-MODEL.md`.

The three device classes are `'phone' | 'tablet' | 'desktop'`, matching the grid-column breakpoints above. When the user rearranges on phone, only the phone layout changes. When they rearrange on desktop, only the desktop layout changes. Switching devices shows a layout that was designed for that device.

**New device, no layout yet:** the first time a user sees a device class they haven't used before, flexion generates a sensible default layout by running a **down-projection** from the nearest layout they *do* have. The down-projection algorithm:

1. Take the larger layout's widgets sorted by `(row ASC, col ASC)` — top-to-bottom, left-to-right reading order. Ties broken by `placementId` lexicographic order (deterministic tiebreaker).
2. Drop any widget whose `minSize.w` is wider than the target grid's column count.
3. Clamp each remaining widget's `w` to `min(w, targetCols)`.
4. Pack them using row-fill:
   a. Iterate through the filtered widgets in the reading order above.
   b. For each widget, find the **leftmost** `(col, row)` where the widget's `(w, h)` rectangle fits without overlapping any already-placed widget and without exceeding `targetCols`.
   c. Scan left-to-right within the current row first; if no fit, increment row and retry from col 0.
   d. If no position exists (should never happen if `minSize.w ≤ targetCols`, but guarded), skip the widget and emit a `down-projection-skip` warning.
   e. Place the widget at `(col, row)` with clamped `w` and unchanged `h`.

This is deterministic (same input → same output, byte-for-byte, because the sort order has a complete tiebreaker), testable (10 hand-crafted desktop layouts with edge cases are in the test suite), and good enough for v1. The user can then enter sandbox mode and rearrange. A later phase may learn common patterns and suggest smarter down-projections.

## The layout reducer (pure, lives in `packages/domain`)

The single most important architectural decision in this subsystem: **the layout is a pure reducer**, living in `packages/domain/src/sandbox/layout-reducer.ts`, consumed by the platform-specific drag-and-drop bindings on each app. Both web (dnd-kit) and mobile (reanimated + gesture-handler) dispatch the *same* actions into the *same* reducer. The only difference between platforms is how the user's fingers or keyboard turn into those actions.

### Action type

```ts
export type LayoutAction =
  | { type: 'toggle-editing' }
  | { type: 'add-widget'; widgetKey: string; at?: { col: number; row: number } }
  | { type: 'remove-widget'; placementId: string }
  | { type: 'move'; placementId: string; to: { col: number; row: number } }
  | { type: 'resize'; placementId: string; size: { w: number; h: number } }
  | { type: 'toggle-open'; placementId: string }
  | { type: 'reorder'; placements: WidgetPlacement[] }  // atomic bulk replace — used by down-projection and layout reset. Replaces the entire placements array. The caller (down-projection, reset-to-default) is responsible for computing valid, non-overlapping placements. The reducer validates the result against all invariants (no overlap, in bounds) and rejects the whole action if any placement violates.
  | { type: 'reset-to-default' }
  | { type: 'hydrate'; snapshot: LayoutSnapshot }; // load from persistence
```

### State shape

```ts
export interface LayoutState {
  editing: boolean;
  placements: WidgetPlacement[];         // with stable placementId
  pendingWrite: boolean;                 // true between a change and the debounced persistence write
}

// gridCols is NOT in LayoutState — it is DERIVED at render time from the
// current device class (phone=4, tablet=8, desktop=12). Storing it would
// create a sync bug when the device class changes. The reducer receives
// gridCols as a second argument alongside the action:
//
//   function layoutReducer(state: LayoutState, action: LayoutAction, gridCols: number): LayoutState
//
// This means the reducer's behavior is device-aware (it rejects out-of-bounds
// moves) but the state is device-agnostic (placements don't record which grid
// they were laid out on). When a layout is persisted, the deviceClass is stored
// on the LayoutSnapshot (see 02-DOMAIN-MODEL.md), not on the LayoutState.
```

### Reducer invariants (tested, not prayed for)

Every one of these is a pinned test in `packages/domain/test/sandbox/layout-reducer.test.ts`:

1. **No overlap.** After any action, no two placements' rectangles overlap. Overlap-inducing moves are rejected (the state is returned unchanged, and a structured `rejected-overlap` event is emitted via the logger).
2. **Respect min/max.** A `resize` action that would push the widget below its `minSize` or above its `maxSize` is rejected with `rejected-size`.
3. **Respect grid bounds.** Moves or resizes that would push a placement outside `[0, gridCols)` horizontally are rejected with `rejected-oob`.
4. **Stable placementIds.** Reordering, moving, or resizing never changes a placement's `placementId`. Only `add` assigns a new id; only `remove` frees one.
5. **Pure.** Calling the reducer twice with the same `(state, action)` produces deep-equal outputs.
6. **Idempotent `hydrate`.** Hydrating with a snapshot equal to the current state is a no-op.
7. **Open/close doesn't move.** `toggle-open` only changes `openState`; `col`, `row`, `w`, `h`, and `placementId` are untouched.
8. **Editing toggle is independent.** Toggling `editing` doesn't touch placements.

These invariants live in the reducer's test file and run under Vitest in Node. No DOM, no RN, no React — just the reducer and Zod schemas.

## The `WidgetBase` contract

Concrete widgets are React components (on web and mobile), but their *contract* is pure TypeScript and lives in `packages/sandbox/src/widget-spec.ts`. A widget is a pairing of a `WidgetSpec` (declarative metadata) and a `Component` (the renderer).

```ts
export interface WidgetSpec<Config = Record<string, unknown>> {
  /** Stable identifier — e.g., 'fatigue-heatmap'. Changing this is a breaking change. */
  key: string;
  /** Human-readable label for the palette. */
  label: string;
  /** One-sentence description for the palette and for a11y. */
  description: string;
  /** Which app owns this widget. 'shared' means the sandbox package ships it. */
  owner: 'flexion' | 'atlas' | 'budjet' | 'shared';
  /** Icon — a lucide-react icon name on web; an SF Symbol / Material name on mobile. */
  icon: string;
  /** Category for the palette grouping. */
  category: string;
  /** Sizes in grid cells. */
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
  /** Whether this widget has an open form. */
  openForm: 'present' | 'none';
  /** Zod schema for the config blob, or null if the widget has no config. */
  configSchema: ZodSchema<Config> | null;
  /** Default config for freshly added instances. */
  defaultConfig: Config;
  /**
   * Which persistence queries this widget's Component will subscribe to. Pure
   * metadata — the registry uses this for eager preloading and for the "this
   * widget has no data yet" skeleton state. Not a mechanism for fetching data.
   */
  dataKeys: readonly string[];
}

export interface WidgetRenderProps<Config = Record<string, unknown>> {
  /** The placement this instance occupies. */
  placement: WidgetPlacement;
  /** The widget's config, already Zod-parsed via configSchema. */
  config: Config;
  /** True when the grid is in sandbox mode. Widgets should NOT rely on this
   *  to change their content — sandbox mode is for the grid engine, not the
   *  widget. The only legitimate use is to disable in-widget interactions
   *  (e.g., "start session" buttons) while the user is dragging. */
  editing: boolean;
  /** Writes to this widget's config. Validates via configSchema before persisting. */
  setConfig: (patch: Partial<Config>) => void;
  /** The current size in pixels. Widgets use this to choose which layout to render
   *  within their current grid footprint. */
  size: { width: number; height: number };
}
```

### The registry: pluggable, not hard-coded

Atlas uses a static array in `registry.ts`. That works for one app. For a shared package consumed by three apps, each with its own widgets, the registry is a **runtime interface** the app provides at startup:

```ts
export interface WidgetRegistry {
  /** Get a spec by key, or undefined if unknown. */
  get(key: string): WidgetSpec | undefined;
  /** All specs, for the palette. */
  list(): readonly WidgetSpec[];
  /** The Component for a given key. Separate from `get` so specs can ship
   *  without their components (useful for cross-platform imports). */
  getComponent(key: string): ComponentType<WidgetRenderProps> | undefined;
}

export function createRegistry(entries: Array<{
  spec: WidgetSpec;
  component: ComponentType<WidgetRenderProps>;
}>): WidgetRegistry;
```

Each app (`apps/web`, `apps/mobile`) builds its own `WidgetRegistry` at startup, mixing:

- Widgets owned by the shared sandbox package (e.g., a generic `TextNoteWidget`).
- Widgets owned by flexion (`FatigueHeatmap`, `TodaysSessionCard`, etc.).
- In the future, widgets owned by atlas or budjet.

The registry is passed to the grid component via context. Swapping registries is how a test harness runs the grid with a tiny set of fake widgets. This is intentionally simple.

## Drag, drop, resize — the platform bindings

### Web — dnd-kit

The web sandbox binding lives in `packages/sandbox/src/web/` and uses `@dnd-kit/core` + `@dnd-kit/sortable`. Specifically:

- **Pointer sensor** and **keyboard sensor** are both attached. The keyboard sensor requires a **custom `keyboardCoordinateGetter`** (`packages/sandbox/src/web/keyboard-coordinator.ts`) that translates arrow-key presses into cell-relative deltas — dnd-kit's default keyboard sensor moves by *pixel deltas*, not grid cells. Our override: ArrowRight = +1 col, ArrowLeft = -1 col, ArrowDown = +1 row, ArrowUp = -1 row. Enter drops; Escape cancels. Without this override, arrow keys would move by ~15px, which is incorrect for a snapped grid.
- **Screen reader announcements** are wired via dnd-kit's `announcements` option. Pattern borrowed from the life-dashboard briefing style: `"Fatigue Heatmap widget picked up. Use arrow keys to move."` → `"Fatigue Heatmap widget moved to column 3, row 4."`
- **Ghost element during drag** — borrowed from atlas. dnd-kit's `DragOverlay` component renders a portal at the cursor position. Inside the overlay, we render a **dashed outline** of the widget's grid footprint (computed from `placement.w × cellWidth` and `placement.h × cellHeight`), not the widget's actual content. This prevents double-rendered content during drag. Outline style: `border: 2px dashed rgba(102, 102, 102, 0.4)`, matching atlas's visual language. The original widget in the grid is dimmed to 30% opacity during drag to indicate "this is where it was."
- **AABB collision detection** — borrowed from atlas. dnd-kit has its own collision system, but we override it with a grid-aware version so collisions are computed in cell space, not pixel space. The function is `gridCollisionDetection` in `packages/sandbox/src/web/collision.ts`, and it's a straight port of atlas's `rectsOverlap` plus grid snapping.
- **Resize handles** — dnd-kit doesn't natively handle resize, so we build a `useResizable` hook that uses the same pointer sensor under the hood and dispatches `resize` actions to the reducer. Arrow keys with the Cmd/Ctrl modifier resize in the same direction.

None of these touch domain code. None of these know about fatigue.

### Mobile — react-native-reanimated + react-native-gesture-handler

The mobile binding lives in `packages/sandbox/src/native/` and uses:

- **Sequential gesture composition:** `Gesture.LongPress({ minDuration: 400 })` activates first; only on its `onFinalized` callback does `Gesture.Pan()` become active. This is explicitly sequential (not simultaneous), so an aborted long-press (user starts scrolling) never activates drag.
- `Gesture.Pan()` on bottom-right resize handles uses the same sequential composition.
- Reanimated shared values track the drag position on the UI thread. **On gesture end**, the final pixel position is converted to cell-space (snapped to nearest integer cell) and dispatched to the layout reducer via `runOnJS(dispatch)({ type: 'move', ... })`. The `runOnJS` wrapper is mandatory — dispatching directly from a worklet to the JS thread is a known footgun in Reanimated 4 and will silently fail or crash.
- `AccessibilityInfo.isReduceMotionEnabled()` is respected: the iOS-jiggle animation is muted to a static dashed outline when the user has Reduce Motion on.

**Reanimated 4 note:** worklets must use the `'worklet';` pragma, shared values use the `.value` syntax, and gesture composition uses `Gesture.Pan().onEnd(...)`. Pre-v3 code patterns will not work (per `apps/web/AGENTS.md`-style warning — see `apps/mobile/AGENTS.md` which I will write when the mobile scaffold lands).

### What the two bindings share

- **Exactly one code path for state updates**: the layout reducer in `packages/domain`.
- **Identical action types.** A test running the reducer against a pre-recorded sequence of actions produces the same output regardless of which binding dispatched them.
- **The `usePersistentConfig` hook** (borrowed from atlas, extended to use Zod validation).

## Persistence

Already covered in `01-ARCHITECTURE.md`: `PersistenceAdapter` is the contract, with Dexie on web and expo-sqlite on mobile. The sandbox package does **not** implement any adapter — it consumes the one the app provides at startup, via the layout store's `persistenceAdapter` option. This is the same pattern atlas uses and the briefing confirmed it works.

Write-through is debounced 250ms (also borrowed from atlas — the briefing confirmed that interval feels responsive without thrashing). Reads happen once at startup via `hydrate`.

## Per-widget config — the `usePersistentConfig` hook

Atlas's implementation is elegant and we're lifting it almost verbatim, with two extensions:

1. **Zod validation** on both read and write — a config blob that doesn't parse against the widget's `configSchema` falls back to `defaultConfig` and logs a `config-schema-drift` warning.
2. **Optimistic update + rollback on validation failure** — the patch is applied in-memory first, then validated, then persisted. A patch that fails validation doesn't make it to the store.

```ts
export function usePersistentConfig<Config>(
  placement: WidgetPlacement,
  spec: WidgetSpec<Config>,
): [Config, (patch: Partial<Config>) => void];
```

Both platforms (web and mobile) use this same hook; it lives in `packages/sandbox/src/shared/use-persistent-config.ts` and is platform-split only where the store dispatch mechanism differs.

## Accessibility

A rewrite of the relevant checklist section from `01-ARCHITECTURE.md`, tightened for this subsystem:

- [ ] **Keyboard drag works.** Tab focuses a widget in sandbox mode; Space picks it up; arrow keys move one cell at a time; Enter drops; Escape cancels. Free via dnd-kit on web; needs explicit implementation on mobile (via `accessibilityActions`).
- [ ] **Keyboard resize works.** Focus a resize handle; arrow keys change extent by one cell.
- [ ] **Screen reader announces state.** Pick up / move / drop / resize each emit a message through the platform's live region.
- [ ] **Focus rings are visible** on the grid cell, the widget, the resize handle.
- [ ] **Open/close is a toggle button**, not a tap-on-widget-chrome, so assistive tech treats it as a discrete action.
- [ ] **Reduce Motion respected.** The iOS-style jiggle animation on both platforms is muted to a static dashed outline when the user prefers reduced motion.
- [ ] **Contrast in both modes** passes WCAG AA for the sandbox chrome (dashed outline, resize handle) against both light and dark backgrounds.

All of these are tested: axe-core on web (Playwright assertion), manual VoiceOver pass on mobile before each release, unit tests on the keyboard action dispatchers.

## What atlas gets out of this package (the extraction story)

When sandbox is lifted to `packages/sandbox` (the real shared location, not flexion's local copy), atlas's migration is:

1. Delete atlas's `src/components/sandbox/*` and `src/components/widgets/registry.ts`.
2. Add a dependency on `@repo/sandbox`.
3. Wire atlas's existing widgets into the new `WidgetRegistry` interface — each widget's `WidgetSpec` is a ~10-line declaration, and the `Component` import stays the same.
4. Replace atlas's layout store actions with calls to the sandbox layout reducer.
5. Atlas inherits keyboard drag, a11y, and per-device layouts for free — the three things atlas had deferred.

This is a lot of surgery on atlas but steps 1, 2, and 5 are mechanical. Steps 3 and 4 are **not** — and the first draft of this doc undersold them:

**Step 3 is harder than "~10 lines per widget."** Atlas has 40 widgets, each with its own config shape (free-form `Record<string, unknown>` today, stored in localStorage). Migrating to the shared package's `WidgetSpec` contract means:

- **Creating a Zod schema for each widget's config.** Some are trivial (`{ label: string, value: number }`), some are complex (PriorityQueueWidget's filtering/sorting config). Budget ~30 minutes per widget for the non-trivial ones.
- **Migrating persisted config blobs.** Atlas stores layout snapshots in localStorage under `atlas.snapshot.v1`. Old config blobs written before the Zod schemas exist may not parse cleanly. The migration path: on first load after the upgrade, each widget's config blob is validated against its new schema. Blobs that fail validation fall back to `defaultConfig` and emit a `config-schema-drift` warning (the same mechanism flexion uses — see `usePersistentConfig` in this doc). Users lose custom config for widgets whose shape changed; the warning tells them which ones.
- **A startup migration function** that runs once, validates all stored configs, and writes the cleaned snapshot back. This is the same pattern as Dexie version-bump migrations — paired old/new schemas, pure transform function, tested with a fixture of atlas's current snapshot shape.

The **actual migration plan belongs in atlas's own docs**, not here. But this doc acknowledges the cost so whoever picks up the extraction doesn't discover it at step 3 and think the plan was wrong.

**Step 4 (replace layout store actions)** is also more than a find-and-replace. Atlas's Zustand store mixes layout actions with domain actions in the same snapshot. Splitting them means either (a) creating a separate layout slice within atlas's store that delegates to the shared reducer, or (b) restructuring atlas's store to separate domain from layout — the same separation flexion has from day one. Option (b) is more work but is the right long-term answer; option (a) is a shim that works until atlas refactors.

None of this touches atlas's domain code (items, scoring, synthesis). The briefing confirmed atlas's grid code is already nicely isolated from its domain. The config and store work is real but bounded.

## Test invariants (pinned in `packages/sandbox/test/`)

Required before sandbox is marked Phase 1 complete:

1. **Reducer purity, no overlap, respect bounds, stable ids** — listed above under "Reducer invariants."
2. **Down-projection determinism.** Given a desktop layout and a phone grid width, `downProject(layout, phoneGrid)` is deterministic and always produces a valid (no-overlap, in-bounds) phone layout.
3. **Registry contract.** Creating a registry with two specs and querying returns the right specs; querying an unknown key returns `undefined` (not throw).
4. **usePersistentConfig schema drift.** Loading a widget with a config blob that doesn't parse against its schema falls back to `defaultConfig` and emits one `config-schema-drift` warning.
5. **Open/close doesn't move.** Firing `toggle-open` leaves `col`, `row`, `w`, `h` unchanged.
6. **Action replay parity.** A recorded sequence of actions produces the same state regardless of whether it was dispatched by the web binding or the native binding (tested with a fake dispatcher).
7. **Accessibility smoke tests.**
   - Web: axe-core assertion on a mounted grid with three widgets in edit mode.
   - Web: a Playwright test that picks up a widget with the keyboard, moves it, drops it, and asserts the reducer state changed.
   - Native: RNTL test asserting `accessibilityActions` are wired on every widget in edit mode.
8. **Conformance suite for persistence adapters.** Any `PersistenceAdapter` implementation (Dexie, expo-sqlite, future Supabase) round-trips a full layout snapshot including edge cases (empty layout, single widget at maxSize, phone layout from down-projection).

## What this doc defers

- **The concrete widget list for flexion.** That's `05-COMPONENTS.md`. This doc defines the mechanism; that doc declares the inventory.
- **Animation timing and easing curves.** They are part of the design language, not the architecture. A future `docs/11-DESIGN-TOKENS.md` will own them.
- **Multi-select, undo/redo, and layout templates.** All three are reasonable Phase 2+ features; sketched in the `LayoutAction` space by not being precluded, but not implemented.
- **Saving a layout as a shareable preset.** A post-v1 feature for when the user marketplace exists.

## Open questions (genuinely open)

1. **Tile size on native.** On a phone, 4 columns × 56px rows may feel cramped. A phone-specific row height (e.g., 72px) is worth a spike in Phase 4. Keeping the default at 56px until we have real phone usage.
2. **Should the grid support "pinned" widgets that survive a reset?** Atlas's reset wipes a section's layout entirely. Flexion may want the "today's session" card to always come back after a reset. Deferring to product feedback.
3. **Should `toggle-open` persist through a resize?** If a user resizes a widget, does its openState stay where it was, or reset to closed? Lean: stay where it was (explicit user action > implicit reset). Needs a design review.

Everything else in this doc is a closed decision. Opening any of them requires an `08-MISTAKES.md` entry explaining what changed.
