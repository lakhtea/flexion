import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import type {
  TrainingBlockDay,
  TrainingBlockDayBlock,
  TrainingBlockDayExercise,
  TrainingBlockDayWithBlocks,
  Exercise,
} from "@/lib/tempapp/types";

export const dynamic = "force-dynamic";

async function hydrateDay(dayId: string): Promise<TrainingBlockDayWithBlocks | null> {
  const day = await dbGet<TrainingBlockDay>(
    "SELECT * FROM training_block_days WHERE id = ?",
    [dayId]
  );
  if (!day) return null;

  const dayBlocks = await dbAll<TrainingBlockDayBlock>(
    "SELECT * FROM training_block_day_blocks WHERE training_block_day_id = ? ORDER BY sort_order ASC",
    [dayId]
  );

  const blocks = await Promise.all(
    dayBlocks.map(async (db_) => {
      const exercises = await dbAll<TrainingBlockDayExercise>(
        "SELECT * FROM training_block_day_exercises WHERE training_block_day_block_id = ? ORDER BY sort_order ASC",
        [db_.id]
      );
      const hydrated = await Promise.all(
        exercises.map(async (ex) => {
          const exercise = await dbGet<Exercise>(
            "SELECT * FROM exercises WHERE id = ?",
            [ex.exercise_id]
          );
          return { ...ex, exercise: exercise ?? undefined };
        })
      );
      return { ...db_, exercises: hydrated };
    })
  );

  return { ...day, blocks };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const day = await hydrateDay(id);

    if (!day) {
      return Response.json({ error: "Training block day not found" }, { status: 404 });
    }

    return Response.json(day);
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
    const { label, is_rest_day } = body;

    const existing = await dbGet(
      "SELECT * FROM training_block_days WHERE id = ?",
      [id]
    );
    if (!existing) {
      return Response.json({ error: "Training block day not found" }, { status: 404 });
    }

    await dbRun(
      `UPDATE training_block_days SET
        label = COALESCE(?, label),
        is_rest_day = COALESCE(?, is_rest_day)
      WHERE id = ?`,
      [label ?? null, is_rest_day ?? null, id]
    );

    const updated = await dbGet(
      "SELECT * FROM training_block_days WHERE id = ?",
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
