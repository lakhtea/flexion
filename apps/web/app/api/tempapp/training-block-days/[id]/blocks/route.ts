import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import type { TrainingBlockDayBlock } from "@/lib/tempapp/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await request.json();
    const { name, block_type } = body;

    if (!name || !block_type) {
      return Response.json(
        { error: "name and block_type are required" },
        { status: 400 }
      );
    }

    const day = await dbGet(
      "SELECT * FROM training_block_days WHERE id = ?",
      [id]
    );
    if (!day) {
      return Response.json({ error: "Training block day not found" }, { status: 404 });
    }

    // Auto-increment sort_order
    const existing = await dbAll<TrainingBlockDayBlock>(
      "SELECT * FROM training_block_day_blocks WHERE training_block_day_id = ? ORDER BY sort_order DESC LIMIT 1",
      [id]
    );
    const nextSortOrder = existing.length > 0 ? existing[0]!.sort_order + 1 : 0;

    const blockId = crypto.randomUUID();
    await dbRun(
      `INSERT INTO training_block_day_blocks (id, training_block_day_id, name, block_type, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [blockId, id, name, block_type, nextSortOrder]
    );

    const created = await dbGet(
      "SELECT * FROM training_block_day_blocks WHERE id = ?",
      [blockId]
    );
    return Response.json(created, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
