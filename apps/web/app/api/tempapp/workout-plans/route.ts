import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const plans = await dbAll(
      "SELECT * FROM workout_plans ORDER BY created_at DESC"
    );
    return Response.json(plans);
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
      specific_date = null,
      day_of_week = null,
      is_biweekly = 0,
      biweekly_start_date = null,
    } = body;

    const id = crypto.randomUUID();
    await dbRun(
      "INSERT INTO workout_plans (id, specific_date, day_of_week, is_biweekly, biweekly_start_date) VALUES (?, ?, ?, ?, ?)",
      [id, specific_date, day_of_week, is_biweekly, biweekly_start_date]
    );

    const plan = await dbGet("SELECT * FROM workout_plans WHERE id = ?", [id]);
    return Response.json(plan, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
