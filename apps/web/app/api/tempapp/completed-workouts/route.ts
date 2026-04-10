import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit") || "50";
    const offset = url.searchParams.get("offset") || "0";

    const workouts = await dbAll(
      "SELECT * FROM completed_workouts ORDER BY date DESC, completed_at DESC LIMIT ? OFFSET ?",
      [parseInt(limit, 10), parseInt(offset, 10)]
    );

    return Response.json(workouts);
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
    const {
      workout_plan_id = null,
      date,
      notes = null,
      exercises = [],
    } = body;

    if (!date) {
      return Response.json({ error: "date is required" }, { status: 400 });
    }

    const workoutId = crypto.randomUUID();

    // Use sequential dbRun calls since we need intermediate results
    // and exercises array is dynamic
    await dbRun(
      "INSERT INTO completed_workouts (id, workout_plan_id, date, notes) VALUES (?, ?, ?, ?)",
      [workoutId, workout_plan_id, date, notes]
    );

    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      await dbRun(
        `INSERT INTO completed_exercises
          (id, completed_workout_id, exercise_id, block_name, block_type, sets, reps, weight, weight_unit, time_seconds, rpe, rest_seconds, was_superset, comment, skipped, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          workoutId,
          ex.exercise_id,
          ex.block_name || "Unknown",
          ex.block_type || "strength",
          ex.sets ?? null,
          ex.reps ?? null,
          ex.weight ?? null,
          ex.weight_unit || "lbs",
          ex.time_seconds ?? null,
          ex.rpe ?? null,
          ex.rest_seconds ?? null,
          ex.was_superset ?? 0,
          ex.comment ?? null,
          ex.skipped ?? 0,
          i,
        ]
      );
    }

    const workout = await dbGet(
      "SELECT * FROM completed_workouts WHERE id = ?",
      [workoutId]
    ) as Record<string, unknown>;
    const completedExercises = await dbAll(
      "SELECT * FROM completed_exercises WHERE completed_workout_id = ? ORDER BY sort_order ASC",
      [workoutId]
    );

    return Response.json(
      { ...workout, exercises: completedExercises },
      { status: 201 }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
