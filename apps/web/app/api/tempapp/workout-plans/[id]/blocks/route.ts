import { dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id: workout_plan_id } = await params;
    const body = await request.json();
    const { name, block_type = "strength" } = body;

    if (!name) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    // Verify plan exists
    const plan = await dbGet(
      "SELECT * FROM workout_plans WHERE id = ?",
      [workout_plan_id]
    );
    if (!plan) {
      return Response.json({ error: "Plan not found" }, { status: 404 });
    }

    // Get next sort_order
    const maxOrder = await dbGet<{ max_order: number }>(
      "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM workout_blocks WHERE workout_plan_id = ?",
      [workout_plan_id]
    );

    const id = crypto.randomUUID();
    await dbRun(
      "INSERT INTO workout_blocks (id, workout_plan_id, name, block_type, sort_order) VALUES (?, ?, ?, ?, ?)",
      [id, workout_plan_id, name, block_type, (maxOrder?.max_order ?? -1) + 1]
    );

    const block = await dbGet("SELECT * FROM workout_blocks WHERE id = ?", [id]);
    return Response.json(block, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
