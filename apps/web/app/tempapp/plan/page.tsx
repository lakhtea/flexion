import { getAllWorkoutPlans } from "@/lib/tempapp/queries";
import { toPlain } from "@/lib/tempapp/serialize";
import PlanClient from "./PlanClient";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const plans = await getAllWorkoutPlans();

  return <PlanClient initialPlans={toPlain(plans)} />;
}
