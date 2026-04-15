import { dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import { getTrainingBlock } from "@/lib/tempapp/queries";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  try {
    await ensureSchema();
    const { id, dayId } = await params;
    const body = await request.json();

    const block = await getTrainingBlock(id);
    if (!block) {
      return Response.json({ error: "Training block not found" }, { status: 404 });
    }

    const day = block.days.find((d) => d.id === dayId);
    if (!day) {
      return Response.json({ error: "Day not found" }, { status: 404 });
    }

    // Update day fields
    if (body.label !== undefined || body.is_rest_day !== undefined) {
      await dbRun(
        `UPDATE training_block_days SET
          label = COALESCE(?, label),
          is_rest_day = COALESCE(?, is_rest_day)
        WHERE id = ?`,
        [body.label ?? null, body.is_rest_day ?? null, dayId]
      );
    }

    // Add a workout block to this day
    if (body.add_block) {
      const { name, block_type, sort_order } = body.add_block;
      await dbRun(
        `INSERT INTO training_block_day_blocks (id, training_block_day_id, name, block_type, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), dayId, name, block_type, sort_order ?? 0]
      );
    }

    // Delete a workout block from this day
    if (body.delete_block) {
      await dbRun(
        "DELETE FROM training_block_day_blocks WHERE id = ? AND training_block_day_id = ?",
        [body.delete_block, dayId]
      );
    }

    // Add an exercise to a day block
    if (body.add_exercise) {
      const ex = body.add_exercise;
      await dbRun(
        `INSERT INTO training_block_day_exercises
          (id, training_block_day_block_id, exercise_id, sets, reps, weight, weight_unit, time_seconds, rpe, rest_seconds, is_superset_with_next, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          ex.training_block_day_block_id,
          ex.exercise_id,
          ex.sets ?? null,
          ex.reps ?? null,
          ex.weight ?? null,
          ex.weight_unit ?? "lbs",
          ex.time_seconds ?? null,
          ex.rpe ?? null,
          ex.rest_seconds ?? null,
          ex.is_superset_with_next ?? 0,
          ex.sort_order ?? 0,
        ]
      );
    }

    // Update an exercise
    if (body.update_exercise) {
      const ex = body.update_exercise;
      const existing = await dbGet(
        "SELECT * FROM training_block_day_exercises WHERE id = ?",
        [ex.id]
      );
      if (!existing) {
        return Response.json({ error: "Exercise not found" }, { status: 404 });
      }
      await dbRun(
        `UPDATE training_block_day_exercises SET
          sets = COALESCE(?, sets),
          reps = COALESCE(?, reps),
          weight = COALESCE(?, weight),
          weight_unit = COALESCE(?, weight_unit),
          time_seconds = COALESCE(?, time_seconds),
          rpe = COALESCE(?, rpe),
          rest_seconds = COALESCE(?, rest_seconds),
          is_superset_with_next = COALESCE(?, is_superset_with_next)
        WHERE id = ?`,
        [
          ex.sets ?? null,
          ex.reps ?? null,
          ex.weight ?? null,
          ex.weight_unit ?? null,
          ex.time_seconds ?? null,
          ex.rpe ?? null,
          ex.rest_seconds ?? null,
          ex.is_superset_with_next ?? null,
          ex.id,
        ]
      );
    }

    // Delete an exercise
    if (body.delete_exercise) {
      await dbRun(
        "DELETE FROM training_block_day_exercises WHERE id = ?",
        [body.delete_exercise]
      );
    }

    const updated = await getTrainingBlock(id);
    return Response.json(updated);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
