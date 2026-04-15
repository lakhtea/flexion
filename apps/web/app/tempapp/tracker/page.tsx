import { getTrackerGoals, getTrackerProgress } from "@/lib/tempapp/queries";
import { displayWeekRange } from "@/lib/tempapp/date-utils";
import TrackerClient from "./TrackerClient";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const [goals, progress] = await Promise.all([
    getTrackerGoals(),
    getTrackerProgress(),
  ]);
  const weekDisplay = displayWeekRange(new Date());

  return (
    <TrackerClient
      initialGoals={goals}
      initialProgress={progress}
      weekDisplay={weekDisplay}
    />
  );
}
