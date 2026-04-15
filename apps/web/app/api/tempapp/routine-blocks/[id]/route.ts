import { dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const result = await dbRun(
      "DELETE FROM routine_blocks WHERE id = ?",
      [id]
    );

    if (result.changes === 0) {
      return Response.json({ error: "Block not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
