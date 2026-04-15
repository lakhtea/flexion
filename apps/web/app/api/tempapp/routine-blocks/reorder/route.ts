import { dbBatch, ensureSchema } from "@/lib/tempapp/db";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { blocks } = body;

    if (!Array.isArray(blocks)) {
      return Response.json(
        { error: "blocks must be an array of { id, sort_order }" },
        { status: 400 }
      );
    }

    await dbBatch(
      blocks.map((item: { id: string; sort_order: number }) => ({
        sql: "UPDATE routine_blocks SET sort_order = ? WHERE id = ?",
        args: [item.sort_order, item.id],
      }))
    );

    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
