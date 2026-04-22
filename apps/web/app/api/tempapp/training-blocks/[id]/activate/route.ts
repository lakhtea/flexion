import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import { getTrainingBlock } from "@/lib/tempapp/queries";
import type { TrainingBlockDay, TrainingBlockDayBlock, TrainingBlockDayExercise } from "@/lib/tempapp/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await request.json();
    const { start_date } = body;

    if (!start_date) {
      return Response.json(
        { error: "start_date is required" },
        { status: 400 }
      );
    }

    const block = await getTrainingBlock(id);
    if (!block) {
      return Response.json({ error: "Training block not found" }, { status: 404 });
    }

    // Deactivate all other training blocks
    await dbRun(
      "UPDATE training_blocks SET is_active = 0 WHERE id != ?",
      [id]
    );

    // Activate this one
    await dbRun(
      "UPDATE training_blocks SET is_active = 1, start_date = ? WHERE id = ?",
      [start_date, id]
    );

    // Materialize today's workout from the training block template
    const today = new Date().toISOString().split("T")[0]!;
    const startDateObj = new Date(start_date + "T00:00:00");
    const todayObj = new Date(today + "T00:00:00");
    const diffDays = Math.floor(
      (todayObj.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (diffDays >= 0 && (block.is_recurring || diffDays < block.cycle_days)) {
      const dayOffset = diffDays % block.cycle_days;

      const tbDay = await dbGet<TrainingBlockDay>(
        "SELECT * FROM training_block_days WHERE training_block_id = ? AND day_offset = ?",
        [id, dayOffset]
      );

      if (tbDay && !tbDay.is_rest_day) {
        // Only materialize if no plan exists for today
        const existingPlan = await dbGet(
          "SELECT id FROM workout_plans WHERE specific_date = ?",
          [today]
        );

        if (!existingPlan) {
          const planId = crypto.randomUUID();
          await dbRun(
            "INSERT INTO workout_plans (id, specific_date) VALUES (?, ?)",
            [planId, today]
          );

          const dayBlocks = await dbAll<TrainingBlockDayBlock>(
            "SELECT * FROM training_block_day_blocks WHERE training_block_day_id = ? ORDER BY sort_order ASC",
            [tbDay.id]
          );

          for (const tb of dayBlocks) {
            const blockId = crypto.randomUUID();
            await dbRun(
              "INSERT INTO workout_blocks (id, workout_plan_id, name, block_type, sort_order) VALUES (?, ?, ?, ?, ?)",
              [blockId, planId, tb.name, tb.block_type, tb.sort_order]
            );

            const dayExercises = await dbAll<TrainingBlockDayExercise>(
              "SELECT * FROM training_block_day_exercises WHERE training_block_day_block_id = ? ORDER BY sort_order ASC",
              [tb.id]
            );

            for (const ex of dayExercises) {
              await dbRun(
                `INSERT INTO workout_exercises
                 (id, workout_block_id, exercise_id, sets, reps, weight, weight_unit, time_seconds, rpe, rest_seconds, is_superset_with_next, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  crypto.randomUUID(), blockId, ex.exercise_id,
                  ex.sets, ex.reps, ex.weight, ex.weight_unit ?? "lbs",
                  ex.time_seconds, ex.rpe, ex.rest_seconds,
                  ex.is_superset_with_next, ex.sort_order,
                ]
              );
            }
          }
        }
      }
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
