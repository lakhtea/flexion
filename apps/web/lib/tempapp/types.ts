// ── Exercise identity ──
export interface Exercise {
  id: string;
  name: string;
  equipment: string;
  context_label: string;
  default_block_type: string;
  created_at: string;
}

export interface ExerciseTrackerContribution {
  id: string;
  exercise_id: string;
  tracker_key: string;
  value_per_instance: number;
}

// ── Tracker goals ──
export interface TrackerGoal {
  id: string;
  tracker_key: string;
  label: string;
  target_value: number;
  unit: string;
}

// ── Workout plans ──
export interface WorkoutPlan {
  id: string;
  specific_date: string | null;
  day_of_week: number | null;
  is_biweekly: number;
  biweekly_start_date: string | null;
  created_at: string;
}

export interface WorkoutBlock {
  id: string;
  workout_plan_id: string;
  name: string;
  block_type: string;
  sort_order: number;
}

export interface WorkoutExercise {
  id: string;
  workout_block_id: string;
  exercise_id: string;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  weight_unit: string;
  time_seconds: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  is_superset_with_next: number;
  reminder: string | null;
  comment: string | null;
  sort_order: number;
}

// ── Completed workouts (history) ──
export interface CompletedWorkout {
  id: string;
  workout_plan_id: string | null;
  date: string;
  completed_at: string;
  notes: string | null;
}

export interface CompletedExercise {
  id: string;
  completed_workout_id: string;
  exercise_id: string;
  block_name: string;
  block_type: string;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  weight_unit: string;
  time_seconds: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  was_superset: number;
  comment: string | null;
  skipped: number;
  sort_order: number;
}

// ── Routines ──
export interface Routine {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface RoutineBlock {
  id: string;
  routine_id: string;
  name: string;
  block_type: string;
  sort_order: number;
}

export interface RoutineExercise {
  id: string;
  routine_block_id: string;
  exercise_id: string;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  weight_unit: string;
  time_seconds: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  is_superset_with_next: number;
  sort_order: number;
}

// ── API payloads ──
export const BLOCK_TYPES = [
  "warmup",
  "strength",
  "rehab",
  "cardio",
  "stretching",
  "custom",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

// ── Hydrated types (for UI) ──
export interface WorkoutBlockWithExercises extends WorkoutBlock {
  exercises: (WorkoutExercise & { exercise: Exercise; last_performance: CompletedExercise | null })[];
}

export interface WorkoutPlanWithBlocks extends WorkoutPlan {
  blocks: WorkoutBlockWithExercises[];
}

export interface RoutineBlockWithExercises extends RoutineBlock {
  exercises: Array<RoutineExercise & { exercise?: Exercise }>;
}

export interface RoutineWithBlocks extends Routine {
  blocks: RoutineBlockWithExercises[];
}

export interface TrackerProgress {
  tracker_key: string;
  label: string;
  target_value: number;
  current_value: number;
  unit: string;
}
