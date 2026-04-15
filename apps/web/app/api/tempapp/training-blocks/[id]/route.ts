import { dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import { getTrainingBlock } from "@/lib/tempapp/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const block = await getTrainingBlock(id);

    if (!block) {
      return Response.json({ error: "Training block not found" }, { status: 404 });
    }

    return Response.json(block);
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
    const { name, description, is_recurring, start_date, is_active } = body;

    const existing = await dbGet(
      "SELECT * FROM training_blocks WHERE id = ?",
      [id]
    );
    if (!existing) {
      return Response.json({ error: "Training block not found" }, { status: 404 });
    }

    await dbRun(
      `UPDATE training_blocks SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        is_recurring = COALESCE(?, is_recurring),
        start_date = COALESCE(?, start_date),
        is_active = COALESCE(?, is_active)
      WHERE id = ?`,
      [
        name ?? null,
        description ?? null,
        is_recurring ?? null,
        start_date ?? null,
        is_active ?? null,
        id,
      ]
    );

    const updated = await getTrainingBlock(id);
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
    const result = await dbRun("DELETE FROM training_blocks WHERE id = ?", [id]);

    if (result.changes === 0) {
      return Response.json({ error: "Training block not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
