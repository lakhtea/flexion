import { getRoutines } from "@/lib/tempapp/queries";
import RoutinesClient from "./RoutinesClient";

export default async function RoutinesPage() {
  const routines = await getRoutines();

  return <RoutinesClient initialRoutines={routines} />;
}
