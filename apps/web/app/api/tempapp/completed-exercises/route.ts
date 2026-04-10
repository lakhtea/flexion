import { dbAll, ensureSchema } from "@/lib/tempapp/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const exercise_id = url.searchParams.get("exercise_id");
    const date_from = url.searchParams.get("date_from");
    const date_to = url.searchParams.get("date_to");
    const block_type = url.searchParams.get("block_type");
    const limit = url.searchParams.get("limit") || "100";
    const offset = url.searchParams.get("offset") || "0";

    let query = `
      SELECT ce.*, cw.date, cw.completed_at as workout_completed_at
      FROM completed_exercises ce
      JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (exercise_id) {
      query += " AND ce.exercise_id = ?";
      params.push(exercise_id);
    }
    if (date_from) {
      query += " AND cw.date >= ?";
      params.push(date_from);
    }
    if (date_to) {
      query += " AND cw.date <= ?";
      params.push(date_to);
    }
    if (block_type) {
      query += " AND ce.block_type = ?";
      params.push(block_type);
    }

    query += " ORDER BY cw.date DESC, ce.sort_order ASC LIMIT ? OFFSET ?";
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const exercises = await dbAll(query, params);
    return Response.json(exercises);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
