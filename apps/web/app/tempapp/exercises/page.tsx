import { getExercises } from "@/lib/tempapp/queries";
import ExercisesClient from "./ExercisesClient";

export default async function ExercisesPage() {
  const exercises = await getExercises();

  return <ExercisesClient initialExercises={exercises} />;
}
