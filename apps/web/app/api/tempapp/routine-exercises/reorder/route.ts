import { dbBatch, ensureSchema } from "@/lib/tempapp/db";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { exercises } = body;

    if (!Array.isArray(exercises)) {
      return Response.json(
        { error: "exercises must be an array of { id, sort_order }" },
        { status: 400 }
      );
    }

    await dbBatch(
      exercises.map((item: { id: string; sort_order: number }) => ({
        sql: "UPDATE routine_exercises SET sort_order = ? WHERE id = ?",
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
