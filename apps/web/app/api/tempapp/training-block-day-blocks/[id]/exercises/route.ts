import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import type { TrainingBlockDayExercise } from "@/lib/tempapp/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await request.json();
    const {
      exercise_id,
      sets,
      reps,
      weight,
      weight_unit,
      time_seconds,
      rpe,
      rest_seconds,
      is_superset_with_next,
    } = body;

    if (!exercise_id) {
      return Response.json(
        { error: "exercise_id is required" },
        { status: 400 }
      );
    }

    const block = await dbGet(
      "SELECT * FROM training_block_day_blocks WHERE id = ?",
      [id]
    );
    if (!block) {
      return Response.json({ error: "Training block day block not found" }, { status: 404 });
    }

    // Auto-increment sort_order
    const existing = await dbAll<TrainingBlockDayExercise>(
      "SELECT * FROM training_block_day_exercises WHERE training_block_day_block_id = ? ORDER BY sort_order DESC LIMIT 1",
      [id]
    );
    const nextSortOrder = existing.length > 0 ? existing[0]!.sort_order + 1 : 0;

    const exerciseEntryId = crypto.randomUUID();
    await dbRun(
      `INSERT INTO training_block_day_exercises
        (id, training_block_day_block_id, exercise_id, sets, reps, weight, weight_unit, time_seconds, rpe, rest_seconds, is_superset_with_next, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exerciseEntryId,
        id,
        exercise_id,
        sets ?? null,
        reps ?? null,
        weight ?? null,
        weight_unit ?? "lbs",
        time_seconds ?? null,
        rpe ?? null,
        rest_seconds ?? null,
        is_superset_with_next ?? 0,
        nextSortOrder,
      ]
    );

    const created = await dbGet(
      "SELECT * FROM training_block_day_exercises WHERE id = ?",
      [exerciseEntryId]
    );
    return Response.json(created, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
