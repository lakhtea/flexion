# Flexion Temp App

A single-user, local-first workout planner + tracker. Built as a temp route group (`/tempapp/*`) inside the existing Next.js app. Will be replaced by the production app built from the full docs.

## Decisions

- **DB:** SQLite via `better-sqlite3` — zero external services, single file on disk (`tempapp.db`). Synchronous API, fast, no config.
- **Backend:** Next.js API routes at `/api/tempapp/*`. No separate server. Run `npm run dev` and everything works.
- **UI:** Plain CSS with flexbox. No Tailwind for the tempapp pages (too heavy for what we need). Padding for spacing, borders for separation, no margins. Simple colors: `#fafafa` bg, `#333` text, `#2563eb` accent, `#e5e7eb` borders.
- **State:** Server-fetched via `fetch()` in client components. No Zustand, no React Query — just `useEffect` + `useState` for this temp app.
- **IDs:** UUIDs via `crypto.randomUUID()` (v4).
- **Exercise identity:** unique on `(name, equipment, context_label)`. Changing any of those = different exercise. Context labels like "tempo", "2 sec pause", "hills" change the identity for trend tracking but the exercise still contributes to aggregate trackers (total mileage, etc.).

## Pages

| Route | Purpose |
|-------|---------|
| `/tempapp` | Today's workout — shows planned workout for today (specific date OR matching day-of-week/biweekly) |
| `/tempapp/plan` | Calendar-style planner — pick a date or recurring day, build a workout |
| `/tempapp/plan/[date]` | Edit workout for a specific date |
| `/tempapp/history` | Full exercise history — filter by exercise, date range, block type |
| `/tempapp/history/[exerciseId]` | Single exercise deep-dive with trend graph |
| `/tempapp/routines` | Create, edit, manage reusable routines |
| `/tempapp/tracker` | Weekly tracker goals + current progress bars |
| `/tempapp/exercises` | Exercise library — search, create, manage, set tracker contributions |

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/tempapp/exercises` | List/create exercises |
| GET/PUT/DELETE | `/api/tempapp/exercises/[id]` | Single exercise CRUD |
| GET/POST | `/api/tempapp/exercises/[id]/contributions` | Tracker contributions for an exercise |
| GET/POST | `/api/tempapp/workout-plans` | List/create workout plans |
| GET/PUT/DELETE | `/api/tempapp/workout-plans/[id]` | Single plan CRUD (includes blocks + exercises) |
| GET | `/api/tempapp/workout-plans/for-date/[date]` | Get plan(s) that apply to a date |
| POST | `/api/tempapp/workout-plans/[id]/blocks` | Add a block |
| PUT/DELETE | `/api/tempapp/workout-blocks/[id]` | Edit/delete a block |
| POST | `/api/tempapp/workout-blocks/[id]/exercises` | Add exercise to block |
| PUT/DELETE | `/api/tempapp/workout-exercises/[id]` | Edit/delete a workout exercise |
| PUT | `/api/tempapp/workout-blocks/reorder` | Reorder blocks |
| PUT | `/api/tempapp/workout-exercises/reorder` | Reorder exercises |
| POST | `/api/tempapp/completed-workouts` | Record a completed workout |
| GET | `/api/tempapp/completed-workouts` | List completed workouts |
| GET | `/api/tempapp/completed-exercises` | Query completed exercises (filter by exercise_id, date range) |
| GET/POST | `/api/tempapp/routines` | List/create routines |
| GET/PUT/DELETE | `/api/tempapp/routines/[id]` | Single routine CRUD |
| POST | `/api/tempapp/routines/[id]/apply` | Add a routine's exercises to a workout plan |
| GET/POST/PUT/DELETE | `/api/tempapp/tracker-goals` | CRUD tracker goals |
| GET | `/api/tempapp/tracker-progress` | Get current week's tracker progress |

## DB Schema

See `lib/tempapp/db.ts`. Key tables:

- `exercises` — identity: `(name, equipment, context_label)` unique
- `exercise_tracker_contributions` — e.g., "3 mile run → mileage: 3, cardio_minutes: 25"
- `tracker_goals` — "mileage: 15 miles/week", "chest_sets: 10 sets/week"
- `workout_plans` — date-specific or recurring (day_of_week + is_biweekly)
- `workout_blocks` → `workout_exercises` — the planned session structure
- `completed_workouts` → `completed_exercises` — the history
- `routines` → `routine_blocks` → `routine_exercises` — reusable templates

## Todo

### Phase 1: Foundation (current)
- [x] DB schema + types
- [x] Install better-sqlite3
- [ ] API routes: exercises CRUD
- [ ] API routes: workout plans CRUD (with blocks + exercises)
- [ ] API routes: plan-for-date resolver (date-specific > weekly > biweekly)
- [ ] API routes: completed workouts + exercises
- [ ] API routes: routines CRUD + apply
- [ ] API routes: tracker goals + progress
- [ ] API routes: reorder blocks/exercises

### Phase 2: Core UI
- [ ] Layout + nav for tempapp
- [ ] Today's workout page
- [ ] Plan page (date picker + recurring setup)
- [ ] Plan editor (add blocks, add exercises, edit sets/reps/weight/time/rpe/rest)
- [ ] Exercise search/create inline
- [ ] Complete workout flow (mark done, record to history)

### Phase 3: Enrichment
- [ ] Routines page (create, edit, apply to workout)
- [ ] Tracker goals page + progress bars
- [ ] Exercise tracker contributions editor
- [ ] Last-performance display on workout exercises
- [ ] Drag-and-drop reorder for blocks and exercises
- [ ] Supersets visual grouping

### Phase 4: History
- [ ] History page with filtering (by exercise, date range, block type)
- [ ] Single exercise history page with trend graph
- [ ] Comments on exercises (50 char limit)
- [ ] Export/import (if needed)

## Run

```bash
cd apps/flexion/apps/web
npm run dev
# Open http://localhost:3000/tempapp
```

No external DB setup needed. SQLite file created automatically at `apps/web/tempapp.db`.
