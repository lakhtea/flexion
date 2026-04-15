import type { WorkoutExercise, CompletedExercise, Exercise } from "./types";

/**
 * Format weight with unit: "185 lbs" or "80 kg"
 */
export function formatWeight(weight: number | null, unit: string = "lbs"): string {
  if (weight === null) return "";
  return `${weight} ${unit}`;
}

/**
 * Format a workout exercise's details as a single line.
 * e.g., "3 sets x 10 reps @ 185 lbs RPE 8 Rest 90s"
 */
export function formatExerciseDetail(
  ex: Pick<WorkoutExercise, "sets" | "reps" | "weight" | "weight_unit" | "time_seconds" | "rpe" | "rest_seconds">,
): string {
  const parts: string[] = [];
  if (ex.sets !== null) parts.push(`${ex.sets} sets`);
  if (ex.reps !== null) parts.push(`${ex.reps} reps`);
  if (ex.weight !== null) parts.push(`@ ${formatWeight(ex.weight, ex.weight_unit)}`);
  if (ex.time_seconds !== null) parts.push(`${ex.time_seconds}s`);
  if (ex.rpe !== null) parts.push(`RPE ${ex.rpe}`);
  if (ex.rest_seconds !== null) parts.push(`Rest ${ex.rest_seconds}s`);
  return parts.join(" x ").replace("sets x ", "sets x ") || "No details";
}

/**
 * Format a completed exercise's key metrics for "last time" display.
 * e.g., "Last: 3x10 @ 185 lbs RPE 8"
 */
export function formatLastPerformance(last: CompletedExercise | null): string | null {
  if (!last) return null;
  const parts: string[] = [];
  if (last.sets !== null) parts.push(`${last.sets}x`);
  if (last.reps !== null) parts.push(`${last.reps}`);
  if (last.weight !== null) parts.push(`@ ${last.weight} ${last.weight_unit}`);
  if (last.rpe !== null) parts.push(`RPE ${last.rpe}`);
  return parts.length > 0 ? `Last: ${parts.join(" ")}` : null;
}

/**
 * Build a display name for an exercise including equipment and context.
 * e.g., "Chest Press (dumbbells) [2 sec pause]"
 */
export function exerciseDisplayName(ex: Pick<Exercise, "name" | "equipment" | "context_label">): string {
  let display = ex.name;
  if (ex.equipment) display += ` (${ex.equipment})`;
  if (ex.context_label) display += ` [${ex.context_label}]`;
  return display;
}
