import { getTrainingBlocks } from "@/lib/tempapp/queries";
import TrainingBlocksClient from "./TrainingBlocksClient";

export const dynamic = "force-dynamic";

export default async function TrainingBlocksPage() {
  const blocks = await getTrainingBlocks();

  return <TrainingBlocksClient initialBlocks={blocks} />;
}
