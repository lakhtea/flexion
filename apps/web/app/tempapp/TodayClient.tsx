"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  WorkoutPlanWithBlocks,
  WorkoutBlockWithExercises,
  WorkoutExercise,
  Exercise,
  CompletedExercise,
} from "@/lib/tempapp/types";
import { formatExerciseDetail, formatLastPerformance } from "@/lib/tempapp/format";
import { displayDate } from "@/lib/tempapp/date-utils";
import {
  Button,
  Card,
  CardHeader,
  Badge,
  Alert,
  EmptyState,
} from "./components";
import styles from "./page.module.css";

interface TodayClientProps {
  initialPlan: WorkoutPlanWithBlocks | null;
  date: string;
}

export default function TodayClient({ initialPlan, date }: TodayClientProps) {
  const router = useRouter();
  const today = new Date(date + "T00:00:00");
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  function toggleSkip(exerciseId: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }

  async function completeWorkout() {
    if (!initialPlan) return;
    setCompleting(true);
    try {
      const exercises: Array<{
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
      }> = [];

      for (const block of initialPlan.blocks) {
        for (const ex of block.exercises) {
          exercises.push({
            exercise_id: ex.exercise_id,
            block_name: block.name,
            block_type: block.block_type,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            weight_unit: ex.weight_unit,
            time_seconds: ex.time_seconds,
            rpe: ex.rpe,
            rest_seconds: ex.rest_seconds,
            was_superset: ex.is_superset_with_next,
            comment: ex.comment,
            skipped: skipped.has(ex.id) ? 1 : 0,
            sort_order: ex.sort_order,
          });
        }
      }

      const res = await fetch("/api/tempapp/completed-workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workout_plan_id: initialPlan.id,
          date,
          exercises,
        }),
      });

      if (!res.ok) throw new Error("Failed to complete workout");
      setCompleted(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setCompleting(false);
    }
  }

  if (error) {
    return <Alert variant="error">Error: {error}</Alert>;
  }

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.pageTitle}>Today&apos;s Workout</h1>
        <p className={styles.subtitle}>{displayDate(today)}</p>
      </div>

      {completed && (
        <Alert variant="success">Workout completed and recorded!</Alert>
      )}

      {!initialPlan ? (
        <EmptyState>
          <p>No workout planned for today.</p>
          <Link href="/tempapp/plan" className={styles.goToPlannerLink}>
            Go to Planner &rarr;
          </Link>
        </EmptyState>
      ) : (
        <>
          {initialPlan.blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              skipped={skipped}
              onToggleSkip={toggleSkip}
            />
          ))}

          {!completed && (
            <Button
              variant="success"
              size="lg"
              fullWidth
              onClick={completeWorkout}
              disabled={completing}
            >
              {completing ? "Saving..." : "Complete Workout"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function BlockCard({
  block,
  skipped,
  onToggleSkip,
}: {
  block: WorkoutBlockWithExercises;
  skipped: Set<string>;
  onToggleSkip: (id: string) => void;
}) {
  // Group exercises into superset clusters
  const clusters: Array<typeof block.exercises> = [];
  let current: typeof block.exercises = [];

  for (const ex of block.exercises) {
    current.push(ex);
    if (!ex.is_superset_with_next) {
      clusters.push(current);
      current = [];
    }
  }
  if (current.length > 0) clusters.push(current);

  return (
    <Card>
      <CardHeader subtle>
        <span className={styles.blockHeader}>{block.name}</span>
        <Badge variant="blockType">{block.block_type}</Badge>
      </CardHeader>
      <div>
        {clusters.map((cluster, ci) => {
          const isSuperset = cluster.length > 1;
          return (
            <div
              key={ci}
              className={isSuperset ? styles.clusterSuperset : styles.cluster}
            >
              {isSuperset && (
                <div className={styles.supersetLabel}>SUPERSET</div>
              )}
              {cluster.map((ex) => (
                <ExerciseRow
                  key={ex.id}
                  ex={ex}
                  isSkipped={skipped.has(ex.id)}
                  onToggleSkip={() => onToggleSkip(ex.id)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ExerciseRow({
  ex,
  isSkipped,
  onToggleSkip,
}: {
  ex: WorkoutExercise & { exercise: Exercise; last_performance: CompletedExercise | null };
  isSkipped: boolean;
  onToggleSkip: () => void;
}) {
  const lastText = formatLastPerformance(ex.last_performance);

  return (
    <div className={isSkipped ? styles.exerciseRowSkipped : styles.exerciseRow}>
      <div className={styles.exerciseTop}>
        <input
          type="checkbox"
          checked={isSkipped}
          onChange={onToggleSkip}
          title="Skip this exercise"
          className={styles.skipCheckbox}
        />
        <span className={styles.exerciseName}>{ex.exercise.name}</span>
        {ex.exercise.equipment && (
          <Badge variant="equipment">{ex.exercise.equipment}</Badge>
        )}
      </div>
      <div className={styles.exerciseDetail}>
        {formatExerciseDetail(ex)}
      </div>
      {ex.reminder && (
        <div className={styles.exerciseReminder}>
          Reminder: {ex.reminder}
        </div>
      )}
      {ex.comment && (
        <div className={styles.exerciseComment}>
          {ex.comment}
        </div>
      )}
      {lastText && (
        <div className={styles.exerciseLast}>{lastText}</div>
      )}
    </div>
  );
}
