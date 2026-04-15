import { getAllWorkoutPlans } from "@/lib/tempapp/queries";
import PlanClient from "./PlanClient";

export default async function PlanPage() {
  const plans = await getAllWorkoutPlans();

  return <PlanClient initialPlans={plans} />;
}
