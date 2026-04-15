import { getTrainingBlock } from "@/lib/tempapp/queries";
import { notFound } from "next/navigation";
import DayEditorClient from "./DayEditorClient";

export const dynamic = "force-dynamic";

export default async function DayEditorPage({
  params,
}: {
  params: Promise<{ id: string; dayOffset: string }>;
}) {
  const { id, dayOffset } = await params;
  const block = await getTrainingBlock(id);

  if (!block) {
    notFound();
  }

  const offset = parseInt(dayOffset, 10);
  const day = block.days.find((d) => d.day_offset === offset);

  if (!day) {
    notFound();
  }

  return <DayEditorClient block={block} day={day} />;
}
