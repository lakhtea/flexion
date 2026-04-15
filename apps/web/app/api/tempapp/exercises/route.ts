import { dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import { getExercises } from "@/lib/tempapp/queries";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    const exercises = await getExercises(q || undefined);
    return Response.json(exercises);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { name, equipment = "", context_label = "", default_block_type = "strength" } = body;

    if (!name) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    // Check for existing match on (name, equipment, context_label)
    const existing = await dbGet(
      "SELECT * FROM exercises WHERE name = ? AND equipment = ? AND context_label = ?",
      [name, equipment, context_label]
    );

    if (existing) {
      return Response.json(existing);
    }

    const id = crypto.randomUUID();
    await dbRun(
      "INSERT INTO exercises (id, name, equipment, context_label, default_block_type) VALUES (?, ?, ?, ?, ?)",
      [id, name, equipment, context_label, default_block_type]
    );

    const exercise = await dbGet("SELECT * FROM exercises WHERE id = ?", [id]);
    return Response.json(exercise, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
