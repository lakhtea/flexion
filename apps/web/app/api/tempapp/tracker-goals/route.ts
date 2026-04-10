import { dbAll, dbGet, dbRun, ensureSchema } from "@/lib/tempapp/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const goals = await dbAll(
      "SELECT * FROM tracker_goals ORDER BY tracker_key ASC"
    );
    return Response.json(goals);
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
    const { tracker_key, label, target_value, unit = "sets" } = body;

    if (!tracker_key || !label || target_value == null) {
      return Response.json(
        { error: "tracker_key, label, and target_value are required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await dbRun(
      "INSERT INTO tracker_goals (id, tracker_key, label, target_value, unit) VALUES (?, ?, ?, ?, ?)",
      [id, tracker_key, label, target_value, unit]
    );

    const goal = await dbGet(
      "SELECT * FROM tracker_goals WHERE id = ?",
      [id]
    );
    return Response.json(goal, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { id, tracker_key, label, target_value, unit } = body;

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await dbGet(
      "SELECT * FROM tracker_goals WHERE id = ?",
      [id]
    );
    if (!existing) {
      return Response.json({ error: "Goal not found" }, { status: 404 });
    }

    await dbRun(
      `UPDATE tracker_goals SET
        tracker_key = COALESCE(?, tracker_key),
        label = COALESCE(?, label),
        target_value = COALESCE(?, target_value),
        unit = COALESCE(?, unit)
      WHERE id = ?`,
      [tracker_key ?? null, label ?? null, target_value ?? null, unit ?? null, id]
    );

    const updated = await dbGet(
      "SELECT * FROM tracker_goals WHERE id = ?",
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

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const result = await dbRun(
      "DELETE FROM tracker_goals WHERE id = ?",
      [id]
    );

    if (result.changes === 0) {
      return Response.json({ error: "Goal not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
