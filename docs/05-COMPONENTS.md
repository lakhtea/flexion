# 05 — Components

> Read `06-SANDBOX-MODE.md` first — it defines the `WidgetSpec` / `WidgetRenderProps` contract that every entry in this catalog conforms to. This doc is the **inventory** of concrete widgets that ship in Flexion v1, with default sizes, open-form contents, and data dependencies.
>
> Following the life-dashboard pattern (`/Users/lakhteagha/Desktop/apps/life-dashboard/docs/04-COMPONENTS.md`): catalog table up front, then per-widget detail sections.

## The contract (recap)

Every widget in this doc is a `(WidgetSpec, Component)` pair registered in a `WidgetRegistry` at app startup. The `Component` accepts `WidgetRenderProps<Config>` and renders into whatever grid footprint the user has resized it to. Widgets read from stores via selectors; they never fetch.

The short form of the contract, inlined here for quick reference:

```ts
interface WidgetSpec<Config> {
  key: string;                          // e.g., 'flexion.fatigue-heatmap'
  label: string;
  description: string;
  owner: 'flexion' | 'atlas' | 'budjet' | 'shared';
  icon: string;                         // lucide on web, SF/Material on native
  category: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
  openForm: 'present' | 'none';
  configSchema: ZodSchema<Config> | null;
  defaultConfig: Config;
  dataKeys: readonly string[];          // declarative data dependencies
}
```

Per-widget sections below fill in every field.

## Widget key naming

All Flexion widget keys are prefixed `flexion.` — `flexion.fatigue-heatmap`, `flexion.todays-session-card`, etc. Prefix is mandatory and enforced by the registry's Zod schema. Atlas's widgets will be `atlas.*`, BudJet's will be `budjet.*`, and shared-package widgets will be `shared.*`. This makes key collisions impossible across apps and makes telemetry grouping trivial.

## Categories

Widgets in v1 are grouped into **four** categories. The category drives the palette grouping in sandbox mode's "add widget" flow.

1. **Prescription** — what to do next. The recommender's output and its inputs.
2. **Execution** — logging and completing today's work.
3. **Progress** — how you're doing this week / over time.
4. **Reference** — static or semi-static data (programs, PRs, routines).

## v1 catalog (the list a reviewer asks for first)

| # | Widget | Key | Category | Default | Min | Max | Open form | Notes |
|---|--------|-----|----------|---------|-----|-----|-----------|-------|
| 1 | Today's Session | `flexion.todays-session-card` | Prescription | 6×3 | 4×2 | 8×4 | present | The headline widget; shows recommended session and a one-tap accept |
| 2 | Fatigue Heatmap | `flexion.fatigue-heatmap` | Progress | 3×4 | 2×3 | 5×6 | present | Body diagram, color-coded by muscle zone |
| 3 | Weekly Volume Bar | `flexion.weekly-volume-bar` | Progress | 3×1 | 2×1 | 6×2 | present | Single-muscle % of weekly target; `config.muscle` picks which |
| 4 | Muscle Radar | `flexion.muscle-radar` | Progress | 4×4 | 3×3 | 6×6 | present | Radial chart of all 18 muscles vs target |
| 5 | Week Overview | `flexion.week-overview` | Execution | 7×2 | 4×2 | 12×3 | present | Seven day-cards showing status (pristine / skipped / executed) |
| 6 | Recommendation Card | `flexion.recommendation-card` | Prescription | 4×3 | 3×2 | 6×5 | present | Recommender output with rationale; separate from Today's Session for users who want both |
| 7 | Session Logger | `flexion.session-logger` | Execution | 8×6 | 6×4 | 12×10 | none | The "log a set" surface when a session is active; hides when no session is in progress |
| 8 | Quick Stats | `flexion.quick-stats` | Progress | 2×1 | 2×1 | 4×2 | present | Total sets this week, current streak, longest session |
| 9 | Volume Trend | `flexion.volume-trend` | Progress | 4×3 | 3×2 | 8×5 | present | Per-muscle volume over the last N weeks; `config.muscle` and `config.weeks` |
| 10 | Program Card | `flexion.program-card` | Reference | 3×2 | 2×2 | 5×4 | present | Current WeekTemplate name, split type, days trained |
| 11 | PR Tracker | `flexion.pr-tracker` | Reference | 3×3 | 2×2 | 5×5 | present | Personal records by exercise; `config.exercises` limits to a subset |
| 12 | Routine Shortcut | `flexion.routine-shortcut` | Execution | 2×2 | 2×2 | 4×3 | present | One-tap launcher for a saved warmup / stretching routine; `config.routineId` |
| 13 | Skip & Modification History | `flexion.modification-history` | Progress | 4×3 | 3×2 | 6×5 | present | Recent skips and modifications for self-awareness |
| 14 | Missed Session Nudge | `flexion.missed-session-nudge` | Execution | 4×2 | 3×2 | 6×3 | present | The "Let us know how your squats went" prompt from `02-DOMAIN-MODEL.md` |

**Multi-instance widgets.** Some widgets (notably `weekly-volume-bar`, `routine-shortcut`, `volume-trend`) are designed to appear multiple times on the same dashboard, each with different `config` (e.g., one bar for Quads, one for Hamstrings). All instances share the same `widgetKey` (same WidgetSpec, same Component); they are distinguished by their `placementId` (unique per instance) and their per-instance `config` stored on the placement. The grid never uses `widgetKey` as a unique identifier — `placementId` is the identity.

Fourteen widgets is intentionally small. The life-dashboard catalog has 105 because it's a *life dashboard* — Flexion is a training tracker with a tight focus. Adding a 15th widget to v1 is a design failure; the right move is to make the existing ones better.

## Data dependency keys

A widget's `dataKeys` array is a declarative list of store selectors it subscribes to. The keys are strings by convention, not typed, but every shipped widget's keys must correspond to a real selector in `packages/domain/src/stores/`. The registry validates this at startup in development mode.

The selectors that exist in v1:

| `dataKey` | Returns | Used by |
|-----------|---------|---------|
| `currentWeek` | The current `Session[]` for this week | most widgets |
| `muscleTargets` | The user's `MuscleTargets` | fatigue widgets |
| `fatigueState` | Computed `FatigueState` for this week | fatigue widgets |
| `recommendation` | The recommender's current output | prescription widgets |
| `weekTemplate` | The user's active `WeekTemplate` | reference widgets |
| `exercises` | The full exercise index | logger, PR tracker |
| `routines` | Seed + user routines | routine shortcut |
| `modifications` | Flat list of modifications across recent weeks | history widget |
| `skips` | Flat list of skips across recent weeks | history widget |
| `prs` | Computed personal records per exercise | PR tracker |
| `volumeSeries` | Computed per-muscle weekly volume time series | volume trend |

Every widget's `dataKeys` entry has to match one of these. Adding a new key requires adding the selector first, not the widget first.

## Per-widget specifications

Each entry gives: `WidgetSpec` (as a TypeScript literal), closed-form content, open-form content, interactions, and data dependencies.

### 1. Today's Session (`flexion.todays-session-card`)

**The single most important widget in the app.** This is what the user sees first when they open Flexion; it answers the question "what do I do right now?"

```ts
{
  key: 'flexion.todays-session-card',
  label: "Today's Session",
  description: "What you're doing today, pulled from the recommender.",
  owner: 'flexion',
  icon: 'Dumbbell',
  category: 'Prescription',
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 8, h: 4 },
  openForm: 'present',
  configSchema: null,
  defaultConfig: {},
  dataKeys: ['recommendation', 'currentWeek', 'fatigueState'],
}
```

**Closed form:**

- Top line: the session label (e.g., "Lower Strength") or "Rest day" if the recommender returned a rest day.
- Middle: top-three exercise chips (exercise name + set count), or a restful icon and "You've hit target on every muscle. Rest up." for rest days.
- Bottom: a primary "Start session" button for a session recommendation, or "Mark rest day" for a rest-day recommendation.

**Open form:**

- The rationale string from the recommender, verbatim. One sentence like: *"Your quads are at 42% this week. This Lower Strength session hits them without touching your triceps, which are already over."*
- A small "Why this session?" expansion that shows the structured `signals` array rendered as a list: top-template score, under-target muscles, avoided muscles.
- A secondary "Pick another" button that cycles to the next-best recommendation.

**Interactions:**
- Start session → transitions the `Session` from pristine to executed by entering the Session Logger widget if it's on the dashboard, or navigating to a full-screen logger if not.
- Mark rest day → transitions the `Session` to skipped with `reason: 'rest-day-earned'`.
- Pick another → re-runs the recommender with the current top-K dropped and returns the next-best.

### 2. Fatigue Heatmap (`flexion.fatigue-heatmap`)

The most recognizable Flexion widget — a front/back body diagram with muscles colored by zone.

```ts
{
  key: 'flexion.fatigue-heatmap',
  label: 'Fatigue Heatmap',
  description: 'Body diagram colored by this week’s fatigue zones.',
  owner: 'flexion',
  icon: 'Flame',
  category: 'Progress',
  defaultSize: { w: 3, h: 4 },
  minSize: { w: 2, h: 3 },
  maxSize: { w: 5, h: 6 },
  openForm: 'present',
  configSchema: z.object({
    view: z.enum(['front', 'back', 'both']).default('both'),
    showLabels: z.boolean().default(false),
  }),
  defaultConfig: { view: 'both', showLabels: false },
  dataKeys: ['fatigueState', 'muscleTargets'],
}
```

**Closed form:** the body diagram with muscle regions colored by zone (gray = unset, muted = under, solid = at, amber = over-soft, red = over-hard). No text — just the silhouette.

**Open form:** same diagram, plus percentage labels on each muscle ("Quads 78%"), plus a compact legend in a corner ("Under / At / Over"). The legend is always present in open form regardless of size.

**Interactions:** tapping a muscle drills into that muscle's `VolumeTrend` view (either by focusing the sibling widget if present, or opening a full-screen modal).

**Accessibility:** the body diagram is a `role="img"` with `aria-label` describing the overall state ("Quads 78%, Hamstrings 62%, Chest 95%. Two muscles over target: Triceps, Forearms."). Individual muscles are keyboard-focusable buttons inside the SVG.

### 3. Weekly Volume Bar (`flexion.weekly-volume-bar`)

The atomic fatigue widget. You add one per muscle you care most about. Meant to be multi-instantiable — a user who's rehabbing a shoulder might have four of these for the four shoulder-adjacent muscles.

```ts
{
  key: 'flexion.weekly-volume-bar',
  label: 'Weekly Volume Bar',
  description: "One muscle's weekly target progress.",
  owner: 'flexion',
  icon: 'BarChart3',
  category: 'Progress',
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  maxSize: { w: 6, h: 2 },
  openForm: 'present',
  configSchema: z.object({
    muscle: z.enum(MUSCLE_GROUPS),
  }),
  defaultConfig: { muscle: 'Quads' },
  dataKeys: ['fatigueState', 'muscleTargets'],
}
```

**Closed form:** a horizontal bar with muscle name on the left, percentage on the right, zone color as the fill.

**Open form:** same bar, plus the raw numbers ("14.2 / 18.0 volume units"), plus the set count contributing this week ("6 sets"), plus a 4-week sparkline below the bar. All within the same grid footprint.

**Interactions:** tap opens a full-screen detail view for that muscle.

### 4. Muscle Radar (`flexion.muscle-radar`)

```ts
{
  key: 'flexion.muscle-radar',
  label: 'Muscle Radar',
  description: 'Radial chart of all muscles vs weekly target.',
  owner: 'flexion',
  icon: 'Radar',
  category: 'Progress',
  defaultSize: { w: 4, h: 4 },
  minSize: { w: 3, h: 3 },
  maxSize: { w: 6, h: 6 },
  openForm: 'present',
  configSchema: z.object({
    showUnsetMuscles: z.boolean().default(false),
  }),
  defaultConfig: { showUnsetMuscles: false },
  dataKeys: ['fatigueState', 'muscleTargets'],
}
```

**Closed form:** radial chart with one spoke per active muscle (target = outer ring, current = inner shape). Shape color shifts toward amber/red if any muscle is over.

**Open form:** same chart, plus a small list under it showing the three muscles farthest below target and the three farthest over target. ("Under: Biceps, Calves, Rear Delts. Over: Triceps.")

### 5. Week Overview (`flexion.week-overview`)

```ts
{
  key: 'flexion.week-overview',
  label: 'Week Overview',
  description: "This week's sessions at a glance.",
  owner: 'flexion',
  icon: 'Calendar',
  category: 'Execution',
  defaultSize: { w: 7, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 3 },
  openForm: 'present',
  configSchema: null,
  defaultConfig: {},
  dataKeys: ['currentWeek', 'weekTemplate'],
}
```

**Closed form:** seven stacked day cards, Mon–Sun. Each card shows: day name, status icon (pristine clock / checkmark / skip dash), and the planned day label (or "Rest" for rest days). Today's card is highlighted.

**Open form:** same cards, but each one expands to show the primary exercise of the planned session and (for executed sessions) the completion percentage. Past pristine sessions that have gone unnoticed are rendered with the `MissedSessionNudge` chip embedded.

**Interactions:** tap a day card → navigate to that day's session (log it, review it, or mark it skipped).

### 6. Recommendation Card (`flexion.recommendation-card`)

Smaller and more focused than Today's Session — for users who want the recommender's output visible without the session-start ergonomics.

```ts
{
  key: 'flexion.recommendation-card',
  label: 'Recommendation',
  description: "What the recommender suggests right now.",
  owner: 'flexion',
  icon: 'Sparkles',
  category: 'Prescription',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 6, h: 5 },
  openForm: 'present',
  configSchema: null,
  defaultConfig: {},
  dataKeys: ['recommendation'],
}
```

**Closed form:** recommendation kind ("Today: Lower Strength" or "Today: Rest"), plus the one-sentence summary.

**Open form:** closed-form content, plus the list of under-target and avoided muscles with their current percentages, plus every signal in the `signals` array rendered as a key/value row.

### 7. Session Logger (`flexion.session-logger`)

The only widget with `openForm: 'none'`. It's big, it's focused, it's only useful while you're in a session.

```ts
{
  key: 'flexion.session-logger',
  label: 'Session Logger',
  description: 'Log sets for the currently-active session.',
  owner: 'flexion',
  icon: 'ClipboardList',
  category: 'Execution',
  defaultSize: { w: 8, h: 6 },
  minSize: { w: 6, h: 4 },
  maxSize: { w: 12, h: 10 },
  openForm: 'none',
  configSchema: null,
  defaultConfig: {},
  dataKeys: ['currentWeek', 'exercises'],
}
```

**Rendered content:** mirrors the prototype's set-by-set logging interface but cleaned up: block → exercise → sets grid, with polymorphic set rows (reps / time / note), RPE column always present (never hidden), add/remove set buttons, swap-exercise button that opens the alternatives modal. The weight prefill uses `ExerciseAlternative.weightScale` as documented in `02-DOMAIN-MODEL.md`.

**When no session is active:** renders a "No session in progress" empty state with a single "Start today's session" button that triggers the recommender. This is the only widget whose content depends on whether a session is live.

**Modifications UX:** a kebab menu per block / per exercise opens the modification palette (the seed ModificationPreset library), letting the user record *why* they changed something without leaving the logger.

**Skip UX:** a kebab menu on the session header opens the skip palette (the seed SkipPreset library), turning the entire session into a skipped session in one tap.

### 8. Quick Stats (`flexion.quick-stats`)

```ts
{
  key: 'flexion.quick-stats',
  label: 'Quick Stats',
  description: 'Sets this week, streak, and longest session.',
  owner: 'flexion',
  icon: 'Trophy',
  category: 'Progress',
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  maxSize: { w: 4, h: 2 },
  openForm: 'present',
  configSchema: null,
  defaultConfig: {},
  dataKeys: ['currentWeek'],
}
```

**Closed form:** three numbers laid out horizontally — "38 sets this week · 12-day streak · longest session: 76 min."

**Open form:** same three numbers, plus a secondary line showing week-over-week deltas ("+6 sets vs last week, streak hit new personal best").

### 9. Volume Trend (`flexion.volume-trend`)

```ts
{
  key: 'flexion.volume-trend',
  label: 'Volume Trend',
  description: 'Weekly volume for one muscle over time.',
  owner: 'flexion',
  icon: 'TrendingUp',
  category: 'Progress',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 8, h: 5 },
  openForm: 'present',
  configSchema: z.object({
    muscle: z.enum(MUSCLE_GROUPS),
    weeks: z.number().int().min(2).max(52).default(8),
  }),
  defaultConfig: { muscle: 'Quads', weeks: 8 },
  dataKeys: ['volumeSeries', 'muscleTargets'],
}
```

**Closed form:** a line chart of weekly volume for the configured muscle, with a horizontal target line. Recent weeks on the right.

**Open form:** same chart, plus an annotation for the current week's percentage, plus a small table below showing the last 4 weeks' raw numbers.

### 10. Program Card (`flexion.program-card`)

```ts
{
  key: 'flexion.program-card',
  label: 'Program',
  description: 'Your current training split.',
  owner: 'flexion',
  icon: 'FileText',
  category: 'Reference',
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 5, h: 4 },
  openForm: 'present',
  configSchema: null,
  defaultConfig: {},
  dataKeys: ['weekTemplate'],
}
```

**Closed form:** week template name ("Upper/Lower 4-Day"), split type, days/week count.

**Open form:** same header, plus a bullet list of planned days with their labels, plus an "Edit program" button.

### 11. PR Tracker (`flexion.pr-tracker`)

```ts
{
  key: 'flexion.pr-tracker',
  label: 'PRs',
  description: 'Personal records per exercise.',
  owner: 'flexion',
  icon: 'Award',
  category: 'Reference',
  defaultSize: { w: 3, h: 3 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 5, h: 5 },
  openForm: 'present',
  configSchema: z.object({
    exerciseSlugs: z.array(z.string()).max(8).default([]),
  }),
  defaultConfig: { exerciseSlugs: [] },
  dataKeys: ['prs'],
}
```

**Closed form:** a list of the user's top PRs (or the configured subset if `exerciseSlugs` is non-empty). Each row: exercise name, best set (e.g., "225 × 5"), date achieved.

**Open form:** same list, plus a "new since last week" badge on rows that have moved up in the last 7 days.

**PR definition (pinned here for the test that computes them):** a PR for an exercise is the logged set with the highest *estimated 1RM* using the Epley formula: `1RM ≈ weight × (1 + reps / 30)`. Ties broken by most recent. PR computation lives in `packages/domain/src/prs/calc-prs.ts` with its own test suite. The formula is a constant; changing it is a mistakes-log event.

### 12. Routine Shortcut (`flexion.routine-shortcut`)

```ts
{
  key: 'flexion.routine-shortcut',
  label: 'Routine',
  description: 'One-tap launcher for a saved routine.',
  owner: 'flexion',
  icon: 'Play',
  category: 'Execution',
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 4, h: 3 },
  openForm: 'present',
  configSchema: z.object({
    routineId: z.string(),
  }),
  defaultConfig: { routineId: 'seed.lower-body-stretch' },
  dataKeys: ['routines'],
}
```

**Closed form:** routine name, icon, step count ("6 steps · 6m 30s").

**Open form:** step-by-step preview of the routine with durations.

**Interactions:** tap → launches the routine full-screen (a `RoutinePlayer` view that walks through each step with a timer).

### 13. Skip & Modification History (`flexion.modification-history`)

For self-awareness. Lets the user see patterns in how they deviate from plan.

```ts
{
  key: 'flexion.modification-history',
  label: 'Modifications & Skips',
  description: 'Recent deviations from your plan.',
  owner: 'flexion',
  icon: 'History',
  category: 'Progress',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 6, h: 5 },
  openForm: 'present',
  configSchema: z.object({
    lookbackDays: z.number().int().min(7).max(60).default(14),
  }),
  defaultConfig: { lookbackDays: 14 },
  dataKeys: ['skips', 'modifications'],
}
```

**Closed form:** a compact timeline of the last N days, each entry a single line: icon + date + summary ("Mar 12 — Skipped Lower Strength: injury", "Mar 14 — Swapped Squat for Leg Press: equipment").

**Open form:** same timeline, plus a small aggregate at the top: "You skipped 2 sessions in the last 14 days; the most common reason was 'injury'." This is the kind of gentle pattern-spotting a real trainer would surface.

### 14. Missed Session Nudge (`flexion.missed-session-nudge`)

The concrete implementation of the pristine-past-session UX described in `02-DOMAIN-MODEL.md`. Appears on the dashboard automatically when any session is pristine and in the past.

```ts
{
  key: 'flexion.missed-session-nudge',
  label: 'Backfill',
  description: 'Nudges the user to log or skip a past pristine session.',
  owner: 'flexion',
  icon: 'MessageCircle',
  category: 'Execution',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 6, h: 3 },
  openForm: 'present',
  configSchema: null,
  defaultConfig: {},
  dataKeys: ['currentWeek'],
}
```

**Closed form:** one line per pristine-past session: "Let us know how your squats went." with two buttons — "Log it" and "Mark skipped."

**Open form:** same content, plus the planned session label and the planned exercises so the user can remember what they were supposed to do.

**Auto-hide:** when there are zero pristine-past sessions, the widget renders an empty, unobtrusive "All caught up ✓" state (never disappears from the grid — the user placed it there deliberately).

**Rule:** this widget **never auto-fills state**. Tapping "Log it" opens the logger; tapping "Mark skipped" opens the skip-reason picker. The app never invents a reason.

## Widget content vs size — the resize behavior rule

Every widget in this catalog must render meaningfully at **every size in `[minSize, maxSize]`**. The contract is *progressive disclosure*: smaller = less detail, larger = more detail, but never truncated or clipped. Specifically:

- At `minSize`, the widget shows its most essential signal (the closed form).
- At `defaultSize`, the widget shows the closed form at comfortable density.
- At `maxSize`, the widget shows the closed form with maximum secondary information (labels, legends, etc.) — *not* the open form. Open is an orthogonal axis; resizing never toggles it.

A widget that would need to *hide* its primary signal at small sizes fails this rule and should shrink its min instead.

## Widget open/closed rule

Opening a widget is a **content swap within the same footprint**. The widget is responsible for rendering both forms at every size in its declared range. A common implementation pattern:

```tsx
function FatigueHeatmap({ placement, config, size }: WidgetRenderProps<FatigueHeatmapConfig>) {
  const fatigueState = useStore(selectFatigueState);
  return (
    <Card>
      <BodyDiagram state={fatigueState} view={config.view} size={size} />
      {placement.openState === 'open' && <Legend />}
      {placement.openState === 'open' && <MuscleLabels state={fatigueState} />}
    </Card>
  );
}
```

The component reads `placement.openState` directly. It does not get a separate prop for it.

## Testing rules for widgets

Per the testing strategy in `01-ARCHITECTURE.md` — widget tests get ≥30% coverage, mostly smoke:

1. **Every widget has a `render with mock data` test** that mounts it with a representative store state and asserts it produces visible text/ARIA content matching its specification.
2. **Every widget renders at `minSize` and `maxSize`** in a test — not just at default. This catches the "looks fine at default but breaks when shrunk" bug.
3. **Every widget with `openForm: 'present'`** has a test that asserts the closed form and open form produce different DOM (some textContent difference or a visible legend / label).
4. **Every widget with a `configSchema`** has a test that mounting it with an invalid config falls back to `defaultConfig` and logs a warning (the `usePersistentConfig` contract).
5. **Accessibility smoke test** — every widget passes axe-core at default size with default config and a realistic mock store.

These tests live in `apps/web/widgets/__tests__/` and `apps/mobile/widgets/__tests__/`. They're fast, they're mechanical, and they're cheap to maintain.

## How apps wire widgets into the registry

At app startup (both web and mobile), the app imports all its widget specs and components and builds a registry:

```ts
// apps/web/widgets/registry.ts (sketch)
import { createRegistry } from '@repo/sandbox';
import { TodaysSessionCard, todaysSessionCardSpec } from './todays-session-card';
import { FatigueHeatmap, fatigueHeatmapSpec } from './fatigue-heatmap';
// ... 12 more imports

export const webRegistry = createRegistry([
  { spec: todaysSessionCardSpec, component: TodaysSessionCard },
  { spec: fatigueHeatmapSpec, component: FatigueHeatmap },
  // ...
]);
```

The mobile app imports the *same spec files* (which live in `apps/web/widgets/*/spec.ts` — or, better, in a shared subfolder under `packages/ui` — TBD in Phase 4 when mobile is scaffolded) and pairs each spec with its RN component. **Specs are identical across platforms**; only the components differ. Sharing specs enforces that web and mobile have the same widget inventory and the same minimum/maximum sizes.

### Future move (Phase 4+)

Widget specs for widgets owned by Flexion will probably live in `packages/flexion-widgets/` with `web/` and `native/` subfolders, so that specs are shared and components are platform-split. This mirrors how the sandbox package itself is structured. Deferred until mobile is real.

## What's deferred (explicitly)

- **Chart library choice** for VolumeTrend, MuscleRadar, and the sparkline in WeeklyVolumeBar. Leaning Recharts on web for its accessibility story; native is TBD (maybe `victory-native` or a hand-rolled Skia chart). Decided in Phase 3.
- **The RoutinePlayer full-screen view.** That's a route, not a widget, and it gets documented when routes get documented.
- **Widget search / filter in the add-widget palette.** v1 has 14 widgets, the category grouping is enough. When the library grows past 30 it'll need filtering.
- **Per-widget theming / accent colors.** Out of scope for v1.
- **Widget export / share.** Out of scope for v1.

## Open questions (genuinely open)

1. **Should WeeklyVolumeBar and VolumeTrend be the same widget with a config toggle?** Right now they're separate because they answer different questions at different sizes. But a reviewer could argue they're two views of the same data. Decide in Phase 3 after dogfooding.
2. **Should MissedSessionNudge be a widget or a system banner?** A banner is always-on and harder to dismiss; a widget is a grid citizen the user can place or remove. Currently a widget because it respects user agency. If users report they miss it when it's not placed, revisit.
3. **Should PR Tracker show estimated 1RMs directly?** Currently the spec is "best set" (e.g., "225 × 5"). 1RM estimation could be a config toggle. Defer until we have real user feedback.
