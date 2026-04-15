import { dbRun, ensureSchema } from "@/lib/tempapp/db";
import { getTrainingBlock } from "@/lib/tempapp/queries";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await request.json();
    const { start_date } = body;

    if (!start_date) {
      return Response.json(
        { error: "start_date is required" },
        { status: 400 }
      );
    }

    const block = await getTrainingBlock(id);
    if (!block) {
      return Response.json({ error: "Training block not found" }, { status: 404 });
    }

    // Deactivate all other training blocks
    await dbRun(
      "UPDATE training_blocks SET is_active = 0 WHERE id != ?",
      [id]
    );

    // Activate this one
    await dbRun(
      "UPDATE training_blocks SET is_active = 1, start_date = ? WHERE id = ?",
      [start_date, id]
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
