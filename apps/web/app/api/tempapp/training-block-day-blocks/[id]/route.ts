import { dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await request.json();
    const { name, block_type } = body;

    const existing = await dbGet(
      "SELECT * FROM training_block_day_blocks WHERE id = ?",
      [id]
    );
    if (!existing) {
      return Response.json({ error: "Training block day block not found" }, { status: 404 });
    }

    await dbRun(
      `UPDATE training_block_day_blocks SET
        name = COALESCE(?, name),
        block_type = COALESCE(?, block_type)
      WHERE id = ?`,
      [name ?? null, block_type ?? null, id]
    );

    const updated = await dbGet(
      "SELECT * FROM training_block_day_blocks WHERE id = ?",
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
    const result = await dbRun(
      "DELETE FROM training_block_day_blocks WHERE id = ?",
      [id]
    );

    if (result.changes === 0) {
      return Response.json({ error: "Training block day block not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
