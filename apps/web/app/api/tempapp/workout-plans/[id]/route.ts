import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import type { WorkoutBlock, WorkoutExercise, Exercise, CompletedExercise } from "@/lib/tempapp/types";

export const dynamic = "force-dynamic";

async function hydratePlan(planId: string) {
  const plan = await dbGet("SELECT * FROM workout_plans WHERE id = ?", [planId]);
  if (!plan) return null;

  const blocks = await dbAll<WorkoutBlock>(
    "SELECT * FROM workout_blocks WHERE workout_plan_id = ? ORDER BY sort_order ASC",
    [planId]
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const plan = await hydratePlan(id);

    if (!plan) {
      return Response.json({ error: "Plan not found" }, { status: 404 });
    }

    return Response.json(plan);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await request.json();
    const { specific_date, day_of_week, is_biweekly, biweekly_start_date } = body;

    const existing = await dbGet("SELECT * FROM workout_plans WHERE id = ?", [id]);
    if (!existing) {
      return Response.json({ error: "Plan not found" }, { status: 404 });
    }

    await dbRun(
      `UPDATE workout_plans SET
        specific_date = COALESCE(?, specific_date),
        day_of_week = COALESCE(?, day_of_week),
        is_biweekly = COALESCE(?, is_biweekly),
        biweekly_start_date = COALESCE(?, biweekly_start_date)
      WHERE id = ?`,
      [
        specific_date ?? null,
        day_of_week ?? null,
        is_biweekly ?? null,
        biweekly_start_date ?? null,
        id,
      ]
    );

    const updated = await dbGet("SELECT * FROM workout_plans WHERE id = ?", [id]);
    return Response.json(updated);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const result = await dbRun("DELETE FROM workout_plans WHERE id = ?", [id]);

    if (result.changes === 0) {
      return Response.json({ error: "Plan not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
