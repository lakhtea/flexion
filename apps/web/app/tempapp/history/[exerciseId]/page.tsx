import { getExerciseHistory } from "@/lib/tempapp/queries";
import ExerciseHistoryClient from "./ExerciseHistoryClient";

export default async function ExerciseHistoryPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  const { exercise, history } = await getExerciseHistory(exerciseId);

  if (!exercise) {
    return <p>Exercise not found.</p>;
  }

  return (
    <ExerciseHistoryClient
      exercise={exercise}
      history={history}
    />
  );
}
