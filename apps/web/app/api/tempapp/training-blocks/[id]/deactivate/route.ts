import { dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;

    const existing = await dbGet(
      "SELECT * FROM training_blocks WHERE id = ?",
      [id]
    );
    if (!existing) {
      return Response.json({ error: "Training block not found" }, { status: 404 });
    }

    await dbRun(
      "UPDATE training_blocks SET is_active = 0, start_date = NULL WHERE id = ?",
      [id]
    );

    const updated = await dbGet(
      "SELECT * FROM training_blocks WHERE id = ?",
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
