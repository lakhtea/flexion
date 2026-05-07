import { getExerciseHistory } from "@/lib/tempapp/queries";
import { toPlain } from "@/lib/tempapp/serialize";
import ExerciseHistoryClient from "./ExerciseHistoryClient";

export const dynamic = "force-dynamic";

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
      exercise={toPlain(exercise)}
      history={toPlain(history)}
    />
  );
}
