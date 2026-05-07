import { getExercises } from "@/lib/tempapp/queries";
import { toPlain } from "@/lib/tempapp/serialize";
import HistoryClient from "./HistoryClient";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const exercises = await getExercises();

  return <HistoryClient exercises={toPlain(exercises)} />;
}
