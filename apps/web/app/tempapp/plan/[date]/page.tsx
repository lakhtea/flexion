import { getWorkoutForDate, getWorkoutPlan } from "@/lib/tempapp/queries";
import type { WorkoutPlanWithBlocks } from "@/lib/tempapp/types";
import PlanEditorClient from "./PlanEditorClient";

export const dynamic = "force-dynamic";

export default async function PlanEditorPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  let plan: WorkoutPlanWithBlocks | null = null;

  // Try loading as a specific date plan first
  plan = await getWorkoutForDate(date);

  if (!plan) {
    // Try loading by ID (for recurring plans)
    plan = await getWorkoutPlan(date);
  }

  // If no plan exists yet, pass null — the client will create one on first mutation
  return <PlanEditorClient initialPlan={plan} date={date} />;
}
