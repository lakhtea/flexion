import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const contributions = await dbAll(
      "SELECT * FROM exercise_tracker_contributions WHERE exercise_id = ?",
      [id]
    );

    return Response.json(contributions);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id: exercise_id } = await params;
    const body = await request.json();
    const { tracker_key, value_per_instance = 1 } = body;

    if (!tracker_key) {
      return Response.json(
        { error: "tracker_key is required" },
        { status: 400 }
      );
    }

    // Upsert: if this exercise already has a contribution for this tracker_key, update it
    const existing = await dbGet(
      "SELECT * FROM exercise_tracker_contributions WHERE exercise_id = ? AND tracker_key = ?",
      [exercise_id, tracker_key]
    );

    if (existing) {
      await dbRun(
        "UPDATE exercise_tracker_contributions SET value_per_instance = ? WHERE exercise_id = ? AND tracker_key = ?",
        [value_per_instance, exercise_id, tracker_key]
      );

      const updated = await dbGet(
        "SELECT * FROM exercise_tracker_contributions WHERE exercise_id = ? AND tracker_key = ?",
        [exercise_id, tracker_key]
      );
      return Response.json(updated);
    }

    const id = crypto.randomUUID();
    await dbRun(
      "INSERT INTO exercise_tracker_contributions (id, exercise_id, tracker_key, value_per_instance) VALUES (?, ?, ?, ?)",
      [id, exercise_id, tracker_key, value_per_instance]
    );

    const contribution = await dbGet(
      "SELECT * FROM exercise_tracker_contributions WHERE id = ?",
      [id]
    );
    return Response.json(contribution, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
