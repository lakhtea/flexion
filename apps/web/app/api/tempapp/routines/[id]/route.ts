import { dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import { getRoutine } from "@/lib/tempapp/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const routine = await getRoutine(id);

    if (!routine) {
      return Response.json({ error: "Routine not found" }, { status: 404 });
    }

    return Response.json(routine);
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
    const { name, description, add_block, add_exercise } = body;

    const existing = await dbGet(
      "SELECT * FROM routines WHERE id = ?",
      [id]
    );
    if (!existing) {
      return Response.json({ error: "Routine not found" }, { status: 404 });
    }

    // Add a block to the routine
    if (add_block) {
      const blockId = crypto.randomUUID();
      await dbRun(
        `INSERT INTO routine_blocks (id, routine_id, name, block_type, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [blockId, id, add_block.name, add_block.block_type ?? "strength", add_block.sort_order ?? 0]
      );
      const routine = await getRoutine(id);
      return Response.json(routine);
    }

    // Add an exercise to a block
    if (add_exercise) {
      const exId = crypto.randomUUID();
      await dbRun(
        `INSERT INTO routine_exercises (id, routine_block_id, exercise_id, sort_order)
         VALUES (?, ?, ?, ?)`,
        [exId, add_exercise.routine_block_id, add_exercise.exercise_id, add_exercise.sort_order ?? 0]
      );
      const routine = await getRoutine(id);
      return Response.json(routine);
    }

    // Default: update name/description
    await dbRun(
      `UPDATE routines SET
        name = COALESCE(?, name),
        description = COALESCE(?, description)
      WHERE id = ?`,
      [name ?? null, description ?? null, id]
    );

    const updated = await getRoutine(id);
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
    const result = await dbRun("DELETE FROM routines WHERE id = ?", [id]);

    if (result.changes === 0) {
      return Response.json({ error: "Routine not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
