import { getTrainingBlocks } from "@/lib/tempapp/queries";
import TrainingBlocksClient from "./TrainingBlocksClient";

export default async function TrainingBlocksPage() {
  const blocks = await getTrainingBlocks();

  return <TrainingBlocksClient initialBlocks={blocks} />;
}
