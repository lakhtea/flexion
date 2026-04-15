import { dbRun, dbBatch, ensureSchema } from "@/lib/tempapp/db";
import { getTrainingBlocks } from "@/lib/tempapp/queries";

export const dynamic = "force-dynamic";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function getDayLabel(dayOffset: number, cycleDays: number): string {
  if (cycleDays <= 7) {
    return DAY_NAMES[dayOffset % 7]!;
  }
  const weekNumber = Math.floor(dayOffset / 7) + 1;
  const dayName = DAY_NAMES[dayOffset % 7]!;
  return `Week ${weekNumber} - ${dayName}`;
}

export async function GET() {
  try {
    const blocks = await getTrainingBlocks();
    return Response.json(blocks);
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
    const { name, description, cycle_days, is_recurring } = body;

    if (!name || !cycle_days || cycle_days < 1) {
      return Response.json(
        { error: "name and cycle_days (>= 1) are required" },
        { status: 400 }
      );
    }

    const blockId = crypto.randomUUID();
    const allStatements = [
      {
        sql: `INSERT INTO training_blocks (id, name, description, cycle_days, is_recurring)
              VALUES (?, ?, ?, ?, ?)`,
        args: [blockId, name, description ?? "", cycle_days, is_recurring ?? 1],
      },
    ];
    for (let i = 0; i < cycle_days; i++) {
      allStatements.push({
        sql: `INSERT INTO training_block_days (id, training_block_id, day_offset, label, is_rest_day)
              VALUES (?, ?, ?, ?, 0)`,
        args: [
          crypto.randomUUID(),
          blockId,
          i,
          getDayLabel(i, cycle_days),
        ],
      });
    }
    await dbBatch(allStatements);

    const created = await import("@/lib/tempapp/queries").then((m) =>
      m.getTrainingBlock(blockId)
    );
    return Response.json(created, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
