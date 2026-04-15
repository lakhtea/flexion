import { getWorkoutForDate } from "@/lib/tempapp/queries";
import { toDateString } from "@/lib/tempapp/date-utils";
import TodayClient from "./TodayClient";

export default async function TodayPage() {
  const date = toDateString(new Date());
  const plan = await getWorkoutForDate(date);

  return <TodayClient initialPlan={plan} date={date} />;
}
