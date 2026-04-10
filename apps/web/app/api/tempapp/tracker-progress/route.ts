import { dbAll, ensureSchema } from "@/lib/tempapp/db";
import type { TrackerGoal } from "@/lib/tempapp/types";

export const dynamic = "force-dynamic";

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split("T")[0] as string;
}

function getSunday(mondayStr: string): string {
  const d = new Date(mondayStr + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0] as string;
}

export async function GET() {
  try {
    await ensureSchema();

    // Determine current week boundaries (Mon-Sun)
    const todayParts = new Date().toISOString().split("T");
    const today = todayParts[0] ?? new Date().toISOString().slice(0, 10);
    const monday = getMonday(today);
    const sunday = getSunday(monday);

    // Get all tracker goals
    const goals = await dbAll<TrackerGoal>(
      "SELECT * FROM tracker_goals"
    );

    if (goals.length === 0) {
      return Response.json([]);
    }

    // Find all completed workouts this week
    const completedWorkouts = await dbAll<{ id: string; workout_plan_id: string | null; date: string }>(
      "SELECT * FROM completed_workouts WHERE date >= ? AND date <= ?",
      [monday, sunday]
    );

    // For each completed workout, get the exercise_ids that were done (not skipped)
    // Then sum up tracker contributions for those exercises
    const trackerSums: Record<string, number> = {};

    for (const cw of completedWorkouts) {
      const completedExercises = await dbAll<{ exercise_id: string; sets: number | null }>(
        "SELECT * FROM completed_exercises WHERE completed_workout_id = ? AND skipped = 0",
        [cw.id]
      );

      for (const ce of completedExercises) {
        // Get tracker contributions for this exercise
        const contributions = await dbAll<{ tracker_key: string; value_per_instance: number }>(
          "SELECT * FROM exercise_tracker_contributions WHERE exercise_id = ?",
          [ce.exercise_id]
        );

        for (const contrib of contributions) {
          const current = trackerSums[contrib.tracker_key] ?? 0;
          trackerSums[contrib.tracker_key] = current + contrib.value_per_instance;
        }
      }
    }

    // Build progress array
    const progress = goals.map((goal) => ({
      tracker_key: goal.tracker_key,
      label: goal.label,
      target_value: goal.target_value,
      current_value: trackerSums[goal.tracker_key] || 0,
      unit: goal.unit,
    }));

    return Response.json(progress);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
