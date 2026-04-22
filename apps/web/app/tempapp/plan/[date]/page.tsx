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
  const isDateString = /^\d{4}-\d{2}-\d{2}$/.test(date);

  if (isDateString) {
    plan = await getWorkoutForDate(date);
  } else {
    // It's a plan ID (UUID) — for editing recurring plans
    plan = await getWorkoutPlan(date);
  }

  // If no plan exists yet, pass null — the client will create one on first mutation
  return <PlanEditorClient key={plan?.id ?? date} initialPlan={plan} date={date} />;
}
