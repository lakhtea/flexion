import { dbAll, dbGet, ensureSchema } from "@/lib/tempapp/db";
import type { WorkoutBlock, WorkoutExercise, Exercise, CompletedExercise, WorkoutPlan } from "@/lib/tempapp/types";

export const dynamic = "force-dynamic";

async function hydratePlan(plan: WorkoutPlan) {
  const blocks = await dbAll<WorkoutBlock>(
    "SELECT * FROM workout_blocks WHERE workout_plan_id = ? ORDER BY sort_order ASC",
    [plan.id]
  );

  const hydratedBlocks = await Promise.all(
    blocks.map(async (block) => {
      const exercises = await dbAll<WorkoutExercise>(
        "SELECT * FROM workout_exercises WHERE workout_block_id = ? ORDER BY sort_order ASC",
        [block.id]
      );

      const hydratedExercises = await Promise.all(
        exercises.map(async (we) => {
          const exercise = await dbGet<Exercise>(
            "SELECT * FROM exercises WHERE id = ?",
            [we.exercise_id]
          );

          const last_performance = await dbGet<CompletedExercise>(
            `SELECT ce.* FROM completed_exercises ce
             JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
             WHERE ce.exercise_id = ?
             ORDER BY cw.date DESC, cw.completed_at DESC
             LIMIT 1`,
            [we.exercise_id]
          );

          return {
            ...we,
            exercise: exercise ?? null,
            last_performance: last_performance ?? null,
          };
        })
      );

      return { ...block, exercises: hydratedExercises };
    })
  );

  return { ...plan, blocks: hydratedBlocks };
}

function getDayOfWeek(dateStr: string): number {
  // Returns 0=Sunday, 1=Monday, ..., 6=Saturday
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay();
}

function weekDifference(startDateStr: string, targetDateStr: string): number {
  const start = new Date(startDateStr + "T00:00:00");
  const target = new Date(targetDateStr + "T00:00:00");
  const diffMs = target.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    await ensureSchema();
    const { date } = await params;
    const dow = getDayOfWeek(date);

    // Priority 1: exact date match
    let plan = await dbGet<WorkoutPlan>(
      "SELECT * FROM workout_plans WHERE specific_date = ?",
      [date]
    );

    // Priority 2: weekly recurring (non-biweekly)
    if (!plan) {
      plan = await dbGet<WorkoutPlan>(
        "SELECT * FROM workout_plans WHERE day_of_week = ? AND is_biweekly = 0 AND specific_date IS NULL",
        [dow]
      );
    }

    // Priority 3: biweekly recurring with even week difference
    if (!plan) {
      const biweeklyPlans = await dbAll<WorkoutPlan>(
        "SELECT * FROM workout_plans WHERE day_of_week = ? AND is_biweekly = 1 AND specific_date IS NULL",
        [dow]
      );

      for (const bp of biweeklyPlans) {
        if (bp.biweekly_start_date) {
          const weeks = weekDifference(bp.biweekly_start_date, date);
          if (weeks >= 0 && weeks % 2 === 0) {
            plan = bp;
            break;
          }
        }
      }
    }

    if (!plan) {
      return Response.json(null);
    }

    const hydrated = await hydratePlan(plan);
    return Response.json(hydrated);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
