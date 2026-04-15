import { getExercises } from "@/lib/tempapp/queries";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const exercises = await getExercises();

  return <HistoryClient exercises={exercises} />;
}
