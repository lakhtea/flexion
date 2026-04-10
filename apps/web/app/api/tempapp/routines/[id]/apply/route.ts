import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import crypto from "crypto";
import type { RoutineBlock, RoutineExercise } from "@/lib/tempapp/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id: routineId } = await params;
    const body = await request.json();
    const { workout_plan_id } = body;

    if (!workout_plan_id) {
      return Response.json(
        { error: "workout_plan_id is required" },
        { status: 400 }
      );
    }

    // Verify routine exists
    const routine = await dbGet(
      "SELECT * FROM routines WHERE id = ?",
      [routineId]
    );
    if (!routine) {
      return Response.json({ error: "Routine not found" }, { status: 404 });
    }

    // Verify plan exists
    const plan = await dbGet(
      "SELECT * FROM workout_plans WHERE id = ?",
      [workout_plan_id]
    );
    if (!plan) {
      return Response.json({ error: "Plan not found" }, { status: 404 });
    }

    // Get current max sort_order for blocks in the plan
    const maxBlockOrder = await dbGet<{ max_order: number }>(
      "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM workout_blocks WHERE workout_plan_id = ?",
      [workout_plan_id]
    );

    // Get routine blocks and exercises
    const routineBlocks = await dbAll<RoutineBlock>(
      "SELECT * FROM routine_blocks WHERE routine_id = ? ORDER BY sort_order ASC",
      [routineId]
    );

    // Use sequential dbRun calls since we need to read routine_exercises
    // inside the loop for each block
    for (const rb of routineBlocks) {
      const newBlockId = crypto.randomUUID();
      await dbRun(
        "INSERT INTO workout_blocks (id, workout_plan_id, name, block_type, sort_order) VALUES (?, ?, ?, ?, ?)",
        [
          newBlockId,
          workout_plan_id,
          rb.name,
          rb.block_type,
          (maxBlockOrder?.max_order ?? -1) + 1 + rb.sort_order,
        ]
      );

      const routineExercises = await dbAll<RoutineExercise>(
        "SELECT * FROM routine_exercises WHERE routine_block_id = ? ORDER BY sort_order ASC",
        [rb.id]
      );

      for (const re of routineExercises) {
        await dbRun(
          `INSERT INTO workout_exercises
            (id, workout_block_id, exercise_id, sets, reps, weight, weight_unit, time_seconds, rpe, rest_seconds, is_superset_with_next, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            newBlockId,
            re.exercise_id,
            re.sets,
            re.reps,
            re.weight,
            re.weight_unit,
            re.time_seconds,
            re.rpe,
            re.rest_seconds,
            re.is_superset_with_next,
            re.sort_order,
          ]
        );
      }
    }

    return Response.json({ success: true, blocks_added: routineBlocks.length });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
