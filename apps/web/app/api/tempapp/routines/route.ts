import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import type { RoutineBlock, RoutineExercise } from "@/lib/tempapp/types";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const routines = await dbAll(
      "SELECT * FROM routines ORDER BY created_at DESC"
    );

    // Hydrate each routine with its blocks and exercises
    const hydrated = await Promise.all(
      routines.map(async (routine: Record<string, unknown>) => {
        const blocks = await dbAll<RoutineBlock>(
          "SELECT * FROM routine_blocks WHERE routine_id = ? ORDER BY sort_order ASC",
          [routine.id as string]
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
      })
    );

    return Response.json(hydrated);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { name, description = "", blocks = [] } = body;

    if (!name) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const routineId = crypto.randomUUID();

    // Use sequential dbRun calls for the transaction with dynamic nested data
    await dbRun(
      "INSERT INTO routines (id, name, description) VALUES (?, ?, ?)",
      [routineId, name, description]
    );

    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      const blockId = crypto.randomUUID();
      await dbRun(
        "INSERT INTO routine_blocks (id, routine_id, name, block_type, sort_order) VALUES (?, ?, ?, ?, ?)",
        [blockId, routineId, block.name, block.block_type || "strength", bi]
      );

      const blockExercises = block.exercises || [];
      for (let ei = 0; ei < blockExercises.length; ei++) {
        const ex = blockExercises[ei];
        await dbRun(
          `INSERT INTO routine_exercises
            (id, routine_block_id, exercise_id, sets, reps, weight, weight_unit, time_seconds, rpe, rest_seconds, is_superset_with_next, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            blockId,
            ex.exercise_id,
            ex.sets ?? null,
            ex.reps ?? null,
            ex.weight ?? null,
            ex.weight_unit || "lbs",
            ex.time_seconds ?? null,
            ex.rpe ?? null,
            ex.rest_seconds ?? null,
            ex.is_superset_with_next ?? 0,
            ei,
          ]
        );
      }
    }

    const routine = await dbGet(
      "SELECT * FROM routines WHERE id = ?",
      [routineId]
    );
    return Response.json(routine, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
