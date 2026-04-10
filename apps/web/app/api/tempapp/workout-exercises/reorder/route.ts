import { dbBatch, ensureSchema } from "@/lib/tempapp/db";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids)) {
      return Response.json(
        { error: "ids must be an array" },
        { status: 400 }
      );
    }

    await dbBatch(
      ids.map((id: string, i: number) => ({
        sql: "UPDATE workout_exercises SET sort_order = ? WHERE id = ?",
        args: [i, id],
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
