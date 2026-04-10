# 04 — Flowcharts

> All diagrams use Mermaid syntax. Render at [mermaid.live](https://mermaid.live) or in any Mermaid-compatible viewer (VS Code preview, GitHub markdown).
>
> These flows are derived from `02-DOMAIN-MODEL.md`, `03-FATIGUE-SYSTEM.md`, `05-COMPONENTS.md`, and `06-SANDBOX-MODE.md`. If a diagram here contradicts a spec doc, the spec doc wins.

## 1. Log a set (the most important flow)

The critical path: user taps a set row in the Session Logger, enters reps/weight/RPE, and the fatigue gauge updates live.

```mermaid
sequenceDiagram
    participant U as User
    participant SL as SessionLogger Widget
    participant DS as Domain Store (Zustand)
    participant FR as calcFatigue (pure fn)
    participant PA as PersistenceAdapter

    U->>SL: Enters reps, weight, RPE for set
    SL->>DS: dispatch(updateLoggedSet(sessionId, blockIdx, exIdx, setIdx, data))
    DS->>DS: Immer draft: update LoggedSet in session
    DS-->>SL: Re-render with new set values

    Note over DS,FR: Fatigue selector fires (memoized on session identity)
    DS->>FR: calcFatigue(sessions, targets, weekBounds, exerciseIndex)
    FR-->>DS: FatigueState (with warnings if RPE null or exercise unknown)

    Note over DS,PA: Write-through (debounced 250ms)
    DS->>PA: saveSession(updatedSession)
    PA-->>DS: ack

    Note over DS: All fatigue widgets rerender via selectors
    DS-->>U: Dashboard bars/heatmap/radar update live
```

**Key latency target:** from user keystroke to fatigue bar update < 200ms p95 (see `00-VISION.md` success criteria #2).

## 2. Start a session (from recommendation)

```mermaid
flowchart TD
    A[User opens Flexion] --> B{Any pristine session for today?}
    B -->|No| C[Recommender runs]
    B -->|Yes, already started| D[Resume SessionLogger]

    C --> E{Recommendation kind?}
    E -->|session| F[TodaysSessionCard shows: label + exercises + rationale]
    E -->|rest-day| G[TodaysSessionCard shows: Rest day + reason]

    F --> H{User taps?}
    H -->|Start Session| I[Create Session from DayTemplate snapshot]
    H -->|Pick Another| J[Re-run recommender with top-K dropped]
    J --> E

    G --> K{User taps?}
    K -->|Mark Rest Day| L[Create Session with skip: rest-day-earned]
    K -->|Override: Work Out Anyway| M[Show WeekTemplate picker]

    I --> N[Session transitions: pristine → executed]
    N --> O[SessionLogger widget activates]
    O --> P[User logs sets — see Flow 1]

    L --> Q[Session marked skipped, fatigue unchanged]
```

## 3. Skip a session

```mermaid
flowchart TD
    A[User sees planned session] --> B{Skip or modify?}
    B -->|Skip entire session| C[SkipPreset picker opens]
    C --> D[User picks reason or types custom]
    D --> E[Session.skip = SkipSchema with reason + timestamp]
    E --> F[loggedBlocks stays empty]
    F --> G[Fatigue unchanged — skipped muscles stay at current %]
    G --> H[Dashboard: day card shows skip icon + reason]
    H --> I[Recommender recalculates: skipped muscles still under-target]
```

## 4. Modify mid-session (swap exercise)

```mermaid
sequenceDiagram
    participant U as User
    participant SL as SessionLogger
    participant ALT as Alternatives Modal
    participant DS as Domain Store
    participant FR as calcFatigue

    U->>SL: Taps "🔄 Swap" on Barbell Squat
    SL->>ALT: Opens modal with ExerciseAlternatives for barbell-back-squat
    ALT-->>U: Shows: Leg Press (1.5×), Hack Squat (0.9×), Front Squat (0.8×)

    U->>ALT: Picks Leg Press
    ALT->>DS: dispatch(substituteExercise(sessionId, blockIdx, exIdx, 'leg-press'))
    DS->>DS: LoggedExercise.exerciseSlug = 'leg-press'
    DS->>DS: LoggedExercise.substitutedFrom = 'barbell-back-squat'
    DS->>DS: LoggedSet[].weight *= 1.5, rounded to nearest 5 lb
    DS->>DS: Add Modification({ type: 'exercise-substituted', reason: preset text })

    Note over DS,FR: Fatigue recomputes against Leg Press stim map (not Squat)
    DS->>FR: calcFatigue(...)
    FR-->>DS: New FatigueState — quads still stimulated, but stim weights differ

    DS-->>U: Logger shows Leg Press with scaled weights, fatigue bars update
```

## 5. Backfill a missed session (pristine-past nudge)

```mermaid
flowchart TD
    A[Dashboard loads] --> B{Any pristine-past sessions this week?}
    B -->|No| C[MissedSessionNudge shows: All caught up ✓]
    B -->|Yes| D[Nudge shows: Let us know how your squats went]

    D --> E{User taps?}
    E -->|Log It| F[Opens SessionLogger prefilled with planned DayTemplate]
    E -->|Mark Skipped| G[Opens SkipPreset picker]
    E -->|Ignores| H[Nudge persists, no auto-action, no escalation]

    F --> I[User logs sets retroactively]
    I --> J[Session transitions: pristine → executed, fatigue recalculates]

    G --> K[User picks skip reason]
    K --> L[Session transitions: pristine → skipped, fatigue unchanged]
```

## 6. Fatigue recompute pipeline

Shows how `calcFatigue` processes a week's sessions into the `FatigueState` that every widget reads.

```mermaid
flowchart TD
    A[Sessions for current week] --> B[Filter: only sessions with loggedBlocks]
    B --> C[For each session → for each block → for each exercise]
    C --> D{Exercise in index?}
    D -->|No| E[Emit unknown-exercise warning, skip exercise]
    D -->|Yes| F[Get stimMap from exerciseIndex]

    F --> G[For each LoggedSet in exercise]
    G --> H{Set outcome?}
    H -->|dropped| I[Skip set, zero contribution]
    H -->|completed| J{Set kind?}

    J -->|reps with weight| K{RPE null?}
    J -->|time| L{RPE null?}
    J -->|reps only| M{RPE null?}
    J -->|note| N[vol = 0, emit note-set-not-counted warning]

    K -->|Yes| P1[vol = 0, emit rpe-missing warning]
    K -->|No| K2["vol = (weight × reps × rpe/10) / 100"]
    L -->|Yes| P2[vol = 0, emit rpe-missing warning]
    L -->|No| L2["vol = (sec/60) × (rpe/10) × 0.5"]
    M -->|Yes| P3[vol = 0, emit rpe-missing warning]
    M -->|No| M2["vol = reps × (rpe/10) × 0.3"]

    P1 --> AC
    P2 --> AC
    P3 --> AC
    N --> AC

    K2 --> Q[Distribute vol across muscles via stimMap]
    L2 --> Q
    M2 --> Q

    Q --> R["For each muscle M: fatigue[M] += vol × (stim[M] / 5)"]
    R --> S[After all sessions processed]

    S --> T[For each muscle: pct = executed / target]
    T --> U{target === 0?}
    U -->|Yes| V[zone = unset, pct = 0]
    U -->|No| W{pct < 0.85?}
    W -->|Yes| X[zone = under]
    W -->|No| Y{pct ≤ 1.00?}
    Y -->|Yes| Z[zone = at]
    Y -->|No| AA[zone = over]

    AA --> AB[Clamp pct to 2.0 for display]
    X --> AC[Return FatigueState]
    Z --> AC
    V --> AC
    AB --> AC
```

## 7. Sandbox mode: enter, edit, exit

```mermaid
stateDiagram-v2
    [*] --> ViewMode: App loads

    ViewMode --> SandboxMode: User taps Edit toggle
    SandboxMode --> ViewMode: User taps Done toggle
    SandboxMode --> ViewMode: User navigates away (auto-exit)

    state SandboxMode {
        [*] --> Idle
        Idle --> Dragging: Pointer/keyboard picks up widget
        Idle --> Resizing: Pointer/keyboard grabs resize handle
        Idle --> AddingWidget: User taps + button
        Idle --> TogglingOpen: User taps open/close control

        Dragging --> Idle: Drop (move action dispatched to reducer)
        Dragging --> Idle: Cancel (Escape / pointer up outside grid)
        Resizing --> Idle: Release (resize action dispatched to reducer)
        AddingWidget --> Idle: Widget placed (add-widget action)
        AddingWidget --> Idle: Cancelled
        TogglingOpen --> Idle: toggle-open action dispatched
    }

    note right of SandboxMode
        editing: true persists only during the session.
        On next app open, editing: false.
        Layout changes (placements) persist via PersistenceAdapter.
    end note
```

## 8. Recommender decision flow

```mermaid
flowchart TD
    A[Recommender called] --> B[Compute FatigueState for current week]
    B --> C[U = muscles where zone = under, sorted by pct ASC]
    C --> D[O = muscles where zone = over]

    D --> E{U empty?}
    E -->|Yes| F["Return rest-day: every muscle at or above target"]

    E -->|No| G[K = top 3 from U]
    G --> H[Score each DayTemplate in WeekTemplate]
    H --> I["score(t) = Σ template_stim(t,m) for m∈K − 10× Σ template_stim(t,m) for m∈O"]
    I --> J[t_best = argmax score]

    J --> K{"score(t_best) ≤ 0?"}
    K -->|Yes| L["Return rest-day: every session scores ≤ 0\n(all touch more vetoed muscles than targets,\nor none hit any under-target muscles)"]
    K -->|No| M[Instantiate session from t_best]

    M --> N{Time budget set?}
    N -->|No| O[Return session + rationale]
    N -->|Yes| P{Session fits time budget?}
    P -->|Yes| O
    P -->|No| Q[Sort exercises by exercise_score ASC]
    Q --> Q2[Drop lowest-score exercise]
    Q2 --> Q3{Fits time budget now?}
    Q3 -->|Yes| T[Return abbreviated session + rationale noting dropped exercises]
    Q3 -->|No| R{Only 1 exercise left?}
    R -->|Yes| S["Return rest-day: not enough time for effective session"]
    R -->|No| Q2
```

## 9. Per-device layout down-projection

```mermaid
flowchart TD
    A[User opens app on new device class] --> B{Layout exists for this device class?}
    B -->|Yes| C[Load and hydrate existing layout]
    B -->|No| D[Find nearest larger layout]

    D --> E[Sort widgets by row ASC, col ASC, placementId ASC]
    E --> F[Drop widgets where minSize.w > target grid cols]
    F --> G["Clamp remaining widgets: w = min(w, targetCols)"]
    G --> H[Row-fill packing algorithm]

    H --> I[For each widget in sorted order]
    I --> J[Find leftmost col,row where widget fits without overlap]
    J --> K{Position found?}
    K -->|Yes| L[Place widget]
    K -->|No| M[Try next row]
    M --> J

    L --> N{More widgets?}
    N -->|Yes| I
    N -->|No| O[Save generated layout for this device class]
    O --> P[Hydrate and render]
```

## 10. Persistence write-through

```mermaid
sequenceDiagram
    participant A as Any Store Action
    participant Z as Zustand Store
    participant D as Debounce (250ms)
    participant PA as PersistenceAdapter
    participant DB as IndexedDB / SQLite

    A->>Z: dispatch(action)
    Z->>Z: Reducer produces new state
    Z-->>A: Subscribers notified (widgets rerender)

    Z->>D: Schedule write
    Note over D: If another action arrives within 250ms, timer resets
    D->>PA: saveSession(session) or saveLayout(layout)
    PA->>DB: Write to IndexedDB (web) or SQLite (mobile)
    DB-->>PA: ack
    PA-->>Z: pendingWrite = false
```

## What these diagrams don't cover (deferred)

- **Auth flows** — there is no auth in v1 (single-user, local-first).
- **Sync flows** (web ↔ mobile) — v1 is local-only per platform. Sync is Phase 6+.
- **Program creation/editing** — v1 uses preset WeekTemplates. Custom program design is Phase 2+.
- **Routine player step-by-step flow** — the RoutinePlayer is a route, not a widget flow; documented when routes are documented.
