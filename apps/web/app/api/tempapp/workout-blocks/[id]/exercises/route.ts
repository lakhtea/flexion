import { dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id: workout_block_id } = await params;
    const body = await request.json();
    const {
      exercise_id,
      sets = null,
      reps = null,
      weight = null,
      weight_unit = "lbs",
      time_seconds = null,
      rpe = null,
      rest_seconds = null,
      is_superset_with_next = 0,
      reminder = null,
      comment = null,
    } = body;

    if (!exercise_id) {
      return Response.json(
        { error: "exercise_id is required" },
        { status: 400 }
      );
    }

    // Verify block exists
    const block = await dbGet(
      "SELECT * FROM workout_blocks WHERE id = ?",
      [workout_block_id]
    );
    if (!block) {
      return Response.json({ error: "Block not found" }, { status: 404 });
    }

    // Get next sort_order
    const maxOrder = await dbGet<{ max_order: number }>(
      "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM workout_exercises WHERE workout_block_id = ?",
      [workout_block_id]
    );

    const id = crypto.randomUUID();
    await dbRun(
      `INSERT INTO workout_exercises
        (id, workout_block_id, exercise_id, sets, reps, weight, weight_unit, time_seconds, rpe, rest_seconds, is_superset_with_next, reminder, comment, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        workout_block_id,
        exercise_id,
        sets,
        reps,
        weight,
        weight_unit,
        time_seconds,
        rpe,
        rest_seconds,
        is_superset_with_next,
        reminder,
        comment,
        (maxOrder?.max_order ?? -1) + 1,
      ]
    );

    const exercise = await dbGet(
      "SELECT * FROM workout_exercises WHERE id = ?",
      [id]
    );
    return Response.json(exercise, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
