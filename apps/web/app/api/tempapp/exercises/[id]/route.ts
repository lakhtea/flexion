import { dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const exercise = await dbGet("SELECT * FROM exercises WHERE id = ?", [id]);

    if (!exercise) {
      return Response.json({ error: "Exercise not found" }, { status: 404 });
    }

    return Response.json(exercise);
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
    const { name, equipment, context_label, default_block_type } = body;

    const existing = await dbGet("SELECT * FROM exercises WHERE id = ?", [id]);
    if (!existing) {
      return Response.json({ error: "Exercise not found" }, { status: 404 });
    }

    await dbRun(
      `UPDATE exercises SET
        name = COALESCE(?, name),
        equipment = COALESCE(?, equipment),
        context_label = COALESCE(?, context_label),
        default_block_type = COALESCE(?, default_block_type)
      WHERE id = ?`,
      [name ?? null, equipment ?? null, context_label ?? null, default_block_type ?? null, id]
    );

    const updated = await dbGet("SELECT * FROM exercises WHERE id = ?", [id]);
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
    const result = await dbRun("DELETE FROM exercises WHERE id = ?", [id]);

    if (result.changes === 0) {
      return Response.json({ error: "Exercise not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
