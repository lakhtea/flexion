import { getTrackerProgress } from "@/lib/tempapp/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const progress = await getTrackerProgress();
    return Response.json(progress);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
