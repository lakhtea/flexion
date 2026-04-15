import { dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";

export const dynamic = "force-dynamic";

export async function PUT(
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

    const existing = await dbGet(
      "SELECT * FROM training_block_day_exercises WHERE id = ?",
      [id]
    );
    if (!existing) {
      return Response.json({ error: "Training block day exercise not found" }, { status: 404 });
    }

    await dbRun(
      `UPDATE training_block_day_exercises SET
        exercise_id = COALESCE(?, exercise_id),
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
        exercise_id ?? null,
        sets ?? null,
        reps ?? null,
        weight ?? null,
        weight_unit ?? null,
        time_seconds ?? null,
        rpe ?? null,
        rest_seconds ?? null,
        is_superset_with_next ?? null,
        id,
      ]
    );

    const updated = await dbGet(
      "SELECT * FROM training_block_day_exercises WHERE id = ?",
      [id]
    );
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
    const result = await dbRun(
      "DELETE FROM training_block_day_exercises WHERE id = ?",
      [id]
    );

    if (result.changes === 0) {
      return Response.json({ error: "Training block day exercise not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
