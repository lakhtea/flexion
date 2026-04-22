import { dbAll, dbGet, dbRun, ensureSchema } from "./db";
import type {
  Exercise,
  WorkoutPlan,
  WorkoutBlock,
  WorkoutExercise,
  CompletedExercise,
  WorkoutPlanWithBlocks,
  WorkoutBlockWithExercises,
  Routine,
  RoutineBlock,
  RoutineExercise,
  RoutineWithBlocks,
  TrackerGoal,
  TrackerProgress,
  TrainingBlock,
  TrainingBlockDay,
  TrainingBlockDayBlock,
  TrainingBlockDayExercise,
  TrainingBlockWithDays,
  TrainingBlockDayWithBlocks,
} from "./types";
import { getWeekRange } from "./date-utils";

// ── Hydration helpers (shared between server components + API routes) ──

async function hydrateExercisesForBlock(
  blockId: string,
): Promise<WorkoutBlockWithExercises["exercises"]> {
  const exercises = await dbAll<WorkoutExercise>(
    "SELECT * FROM workout_exercises WHERE workout_block_id = ? ORDER BY sort_order ASC",
    [blockId],
  );

  return Promise.all(
    exercises.map(async (we) => {
      const exercise = await dbGet<Exercise>(
        "SELECT * FROM exercises WHERE id = ?",
        [we.exercise_id],
      );
      const last_performance = await dbGet<CompletedExercise>(
        `SELECT ce.* FROM completed_exercises ce
         JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
         WHERE ce.exercise_id = ?
         ORDER BY cw.date DESC, cw.completed_at DESC
         LIMIT 1`,
        [we.exercise_id],
      );
      return {
        ...we,
        exercise: exercise!,
        last_performance: last_performance ?? null,
      };
    }),
  );
}

async function hydratePlanBlocks(planId: string): Promise<WorkoutBlockWithExercises[]> {
  const blocks = await dbAll<WorkoutBlock>(
    "SELECT * FROM workout_blocks WHERE workout_plan_id = ? ORDER BY sort_order ASC",
    [planId],
  );
  return Promise.all(
    blocks.map(async (block) => ({
      ...block,
      exercises: await hydrateExercisesForBlock(block.id),
    })),
  );
}

async function hydrateRoutineBlocks(routineId: string) {
  const blocks = await dbAll<RoutineBlock>(
    "SELECT * FROM routine_blocks WHERE routine_id = ? ORDER BY sort_order ASC",
    [routineId],
  );
  return Promise.all(
    blocks.map(async (block) => {
      const exercises = await dbAll<RoutineExercise>(
        "SELECT * FROM routine_exercises WHERE routine_block_id = ? ORDER BY sort_order ASC",
        [block.id],
      );
      const hydrated = await Promise.all(
        exercises.map(async (re) => {
          const exercise = await dbGet<Exercise>(
            "SELECT * FROM exercises WHERE id = ?",
            [re.exercise_id],
          );
          return { ...re, exercise: exercise ?? undefined };
        }),
      );
      return { ...block, exercises: hydrated };
    }),
  );
}

async function hydrateTrainingBlockDay(dayId: string): Promise<TrainingBlockDayWithBlocks> {
  const day = (await dbGet<TrainingBlockDay>(
    "SELECT * FROM training_block_days WHERE id = ?",
    [dayId],
  ))!;
  const dayBlocks = await dbAll<TrainingBlockDayBlock>(
    "SELECT * FROM training_block_day_blocks WHERE training_block_day_id = ? ORDER BY sort_order ASC",
    [dayId],
  );
  const blocks = await Promise.all(
    dayBlocks.map(async (db_) => {
      const exercises = await dbAll<TrainingBlockDayExercise>(
        "SELECT * FROM training_block_day_exercises WHERE training_block_day_block_id = ? ORDER BY sort_order ASC",
        [db_.id],
      );
      const hydrated = await Promise.all(
        exercises.map(async (ex) => {
          const exercise = await dbGet<Exercise>(
            "SELECT * FROM exercises WHERE id = ?",
            [ex.exercise_id],
          );
          return { ...ex, exercise: exercise ?? undefined };
        }),
      );
      return { ...db_, exercises: hydrated };
    }),
  );
  return { ...day, blocks };
}

// ── Public query functions ──

/**
 * Get the workout for a given date. Priority:
 * 1. Specific date override (workout_plans with specific_date)
 * 2. Active training block (computed from start_date + cycle_days)
 * 3. Weekly recurring workout plan
 * 4. Biweekly recurring workout plan
 */
export async function getWorkoutForDate(date: string): Promise<WorkoutPlanWithBlocks | null> {
  await ensureSchema();
  const dow = new Date(date + "T00:00:00").getDay();

  let plan = await dbGet<WorkoutPlan>(
    "SELECT * FROM workout_plans WHERE specific_date = ?",
    [date],
  );

  if (plan) {
    return { ...plan, blocks: await hydratePlanBlocks(plan.id) };
  }

  // Priority 2: active training block
  const trainingBlockResult = await getTrainingBlockDayForDate(date);
  if (trainingBlockResult) {
    return trainingBlockResult;
  }

  // Priority 3: weekly recurring
  plan = await dbGet<WorkoutPlan>(
    "SELECT * FROM workout_plans WHERE day_of_week = ? AND is_biweekly = 0 AND specific_date IS NULL",
    [dow],
  );
  if (plan) {
    return { ...plan, blocks: await hydratePlanBlocks(plan.id) };
  }

  // Priority 4: biweekly recurring
  const biweeklyPlans = await dbAll<WorkoutPlan>(
    "SELECT * FROM workout_plans WHERE day_of_week = ? AND is_biweekly = 1 AND specific_date IS NULL",
    [dow],
  );
  for (const bp of biweeklyPlans) {
    if (bp.biweekly_start_date) {
      const start = new Date(bp.biweekly_start_date + "T00:00:00");
      const target = new Date(date + "T00:00:00");
      const weeks = Math.floor(
        (target.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      if (weeks >= 0 && weeks % 2 === 0) {
        return { ...bp, blocks: await hydratePlanBlocks(bp.id) };
      }
    }
  }

  return null;
}

/**
 * Check active training blocks for a matching day.
 * When a match is found, MATERIALIZE the training block template into a real
 * workout_plan + workout_blocks + workout_exercises for that specific date.
 * This way all the regular editing/delete APIs work on the materialized plan.
 * The materialized plan is only created once; subsequent calls return the existing plan.
 */
async function getTrainingBlockDayForDate(date: string): Promise<WorkoutPlanWithBlocks | null> {
  const activeBlocks = await dbAll<TrainingBlock>(
    "SELECT * FROM training_blocks WHERE is_active = 1 AND start_date IS NOT NULL",
  );

  const targetDate = new Date(date + "T00:00:00");

  for (const block of activeBlocks) {
    const startDate = new Date(block.start_date! + "T00:00:00");
    const diffDays = Math.floor(
      (targetDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (diffDays < 0) continue;
    if (!block.is_recurring && diffDays >= block.cycle_days) continue;

    const dayOffset = diffDays % block.cycle_days;

    const tbDay = await dbGet<TrainingBlockDay>(
      "SELECT * FROM training_block_days WHERE training_block_id = ? AND day_offset = ?",
      [block.id, dayOffset],
    );

    if (!tbDay || tbDay.is_rest_day) continue;

    // Check if we already materialized a plan for this date
    const existingMaterialized = await dbGet<WorkoutPlan>(
      "SELECT * FROM workout_plans WHERE specific_date = ?",
      [date],
    );
    if (existingMaterialized) {
      return { ...existingMaterialized, blocks: await hydratePlanBlocks(existingMaterialized.id) };
    }

    // Materialize: create a real workout_plan for this specific date
    const planId = crypto.randomUUID();
    await dbRun(
      "INSERT INTO workout_plans (id, specific_date) VALUES (?, ?)",
      [planId, date],
    );

    const hydratedDay = await hydrateTrainingBlockDay(tbDay.id);

    for (const tb of hydratedDay.blocks) {
      const blockId = crypto.randomUUID();
      await dbRun(
        "INSERT INTO workout_blocks (id, workout_plan_id, name, block_type, sort_order) VALUES (?, ?, ?, ?, ?)",
        [blockId, planId, tb.name, tb.block_type, tb.sort_order],
      );

      for (const ex of tb.exercises) {
        const exId = crypto.randomUUID();
        await dbRun(
          `INSERT INTO workout_exercises
           (id, workout_block_id, exercise_id, sets, reps, weight, weight_unit, time_seconds, rpe, rest_seconds, is_superset_with_next, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            exId, blockId, ex.exercise_id,
            ex.sets, ex.reps, ex.weight, ex.weight_unit ?? "lbs",
            ex.time_seconds, ex.rpe, ex.rest_seconds,
            ex.is_superset_with_next, ex.sort_order,
          ],
        );
      }
    }

    // Return the real materialized plan (with real IDs that the edit APIs can use)
    return { ...(await dbGet<WorkoutPlan>("SELECT * FROM workout_plans WHERE id = ?", [planId]))!, blocks: await hydratePlanBlocks(planId) };
  }

  return null;
}

// ── Training block CRUD queries ──

export async function getTrainingBlocks(): Promise<TrainingBlock[]> {
  await ensureSchema();
  return dbAll<TrainingBlock>("SELECT * FROM training_blocks ORDER BY created_at DESC");
}

export async function getTrainingBlock(id: string): Promise<TrainingBlockWithDays | null> {
  await ensureSchema();
  const block = await dbGet<TrainingBlock>(
    "SELECT * FROM training_blocks WHERE id = ?",
    [id],
  );
  if (!block) return null;

  const days = await dbAll<TrainingBlockDay>(
    "SELECT * FROM training_block_days WHERE training_block_id = ? ORDER BY day_offset ASC",
    [block.id],
  );

  const hydratedDays = await Promise.all(
    days.map(async (day) => hydrateTrainingBlockDay(day.id)),
  );

  return { ...block, days: hydratedDays };
}

export async function getWorkoutPlan(id: string): Promise<WorkoutPlanWithBlocks | null> {
  await ensureSchema();
  const plan = await dbGet<WorkoutPlan>(
    "SELECT * FROM workout_plans WHERE id = ?",
    [id],
  );
  if (!plan) return null;
  return { ...plan, blocks: await hydratePlanBlocks(plan.id) };
}

export async function getAllWorkoutPlans(): Promise<WorkoutPlan[]> {
  await ensureSchema();
  return dbAll<WorkoutPlan>("SELECT * FROM workout_plans ORDER BY created_at DESC");
}

export async function getExercises(query?: string): Promise<Exercise[]> {
  await ensureSchema();
  if (query && query.trim()) {
    return dbAll<Exercise>(
      "SELECT * FROM exercises WHERE name LIKE ? ORDER BY name ASC",
      [`%${query.trim()}%`],
    );
  }
  return dbAll<Exercise>("SELECT * FROM exercises ORDER BY name ASC");
}

export async function getExercise(id: string): Promise<Exercise | null> {
  await ensureSchema();
  return dbGet<Exercise>("SELECT * FROM exercises WHERE id = ?", [id]);
}

export async function getRoutines(): Promise<RoutineWithBlocks[]> {
  await ensureSchema();
  const routines = await dbAll<Routine>(
    "SELECT * FROM routines ORDER BY created_at DESC",
  );
  return Promise.all(
    routines.map(async (r) => ({
      ...r,
      blocks: await hydrateRoutineBlocks(r.id),
    })),
  );
}

export async function getRoutine(id: string): Promise<RoutineWithBlocks | null> {
  await ensureSchema();
  const routine = await dbGet<Routine>("SELECT * FROM routines WHERE id = ?", [id]);
  if (!routine) return null;
  return { ...routine, blocks: await hydrateRoutineBlocks(routine.id) };
}

export async function getTrackerGoals(): Promise<TrackerGoal[]> {
  await ensureSchema();
  return dbAll<TrackerGoal>("SELECT * FROM tracker_goals ORDER BY label ASC");
}

export async function getTrackerProgress(): Promise<TrackerProgress[]> {
  await ensureSchema();
  const goals = await dbAll<TrackerGoal>("SELECT * FROM tracker_goals");
  const { start, end } = getWeekRange(new Date());

  const progress: TrackerProgress[] = [];

  for (const goal of goals) {
    const result = await dbGet<{ total: number }>(
      `SELECT COALESCE(SUM(etc.value_per_instance), 0) as total
       FROM completed_exercises ce
       JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
       JOIN exercise_tracker_contributions etc ON etc.exercise_id = ce.exercise_id
       WHERE etc.tracker_key = ?
         AND cw.date >= ? AND cw.date <= ?
         AND ce.skipped = 0`,
      [goal.tracker_key, start, end],
    );
    progress.push({
      tracker_key: goal.tracker_key,
      label: goal.label,
      target_value: goal.target_value,
      current_value: result?.total ?? 0,
      unit: goal.unit,
    });
  }

  return progress;
}

export async function getCompletedExercises(filters: {
  exercise_id?: string;
  date_from?: string;
  date_to?: string;
  block_type?: string;
  limit?: number;
  offset?: number;
}): Promise<(CompletedExercise & { exercise_name?: string; date?: string })[]> {
  await ensureSchema();
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (filters.exercise_id) {
    conditions.push("ce.exercise_id = ?");
    args.push(filters.exercise_id);
  }
  if (filters.date_from) {
    conditions.push("cw.date >= ?");
    args.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push("cw.date <= ?");
    args.push(filters.date_to);
  }
  if (filters.block_type) {
    conditions.push("ce.block_type = ?");
    args.push(filters.block_type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  return dbAll(
    `SELECT ce.*, e.name as exercise_name, cw.date
     FROM completed_exercises ce
     JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
     JOIN exercises e ON ce.exercise_id = e.id
     ${where}
     ORDER BY cw.date DESC, ce.sort_order ASC
     LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );
}

export async function getExerciseHistory(
  exerciseId: string,
): Promise<{ exercise: Exercise | null; history: CompletedExercise[] }> {
  await ensureSchema();
  const exercise = await dbGet<Exercise>(
    "SELECT * FROM exercises WHERE id = ?",
    [exerciseId],
  );
  const history = await dbAll<CompletedExercise & { date: string }>(
    `SELECT ce.*, cw.date
     FROM completed_exercises ce
     JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
     WHERE ce.exercise_id = ?
     ORDER BY cw.date DESC`,
    [exerciseId],
  );
  return { exercise, history };
}
