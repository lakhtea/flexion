import { getExercises } from "@/lib/tempapp/queries";
import { toPlain } from "@/lib/tempapp/serialize";
import ExercisesClient from "./ExercisesClient";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const exercises = await getExercises();

  return <ExercisesClient initialExercises={toPlain(exercises)} />;
}
