import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import type { RoutineBlock, RoutineExercise } from "@/lib/tempapp/types";

export const dynamic = "force-dynamic";

async function hydrateRoutine(routineId: string) {
  const routine = await dbGet(
    "SELECT * FROM routines WHERE id = ?",
    [routineId]
  );
  if (!routine) return null;

  const blocks = await dbAll<RoutineBlock>(
    "SELECT * FROM routine_blocks WHERE routine_id = ? ORDER BY sort_order ASC",
    [routineId]
  );

  const hydratedBlocks = await Promise.all(
    blocks.map(async (block) => {
      const exercises = await dbAll<RoutineExercise>(
        "SELECT * FROM routine_exercises WHERE routine_block_id = ? ORDER BY sort_order ASC",
        [block.id]
      );

      const hydratedExercises = await Promise.all(
        exercises.map(async (re) => {
          const exercise = await dbGet(
            "SELECT * FROM exercises WHERE id = ?",
            [re.exercise_id]
          );
          return { ...re, exercise: exercise ?? null };
        })
      );

      return { ...block, exercises: hydratedExercises };
    })
  );

  return { ...routine, blocks: hydratedBlocks };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const routine = await hydrateRoutine(id);

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
    const { name, description } = body;

    const existing = await dbGet(
      "SELECT * FROM routines WHERE id = ?",
      [id]
    );
    if (!existing) {
      return Response.json({ error: "Routine not found" }, { status: 404 });
    }

    await dbRun(
      `UPDATE routines SET
        name = COALESCE(?, name),
        description = COALESCE(?, description)
      WHERE id = ?`,
      [name ?? null, description ?? null, id]
    );

    const updated = await dbGet(
      "SELECT * FROM routines WHERE id = ?",
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
