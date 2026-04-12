"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type {
  WorkoutPlanWithBlocks,
  WorkoutBlockWithExercises,
  WorkoutExercise,
  Exercise,
  CompletedExercise,
} from "@/lib/tempapp/types";
import {
  Button,
  Card,
  CardHeader,
  Badge,
  Alert,
  EmptyState,
} from "./components";
import styles from "./page.module.css";

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function displayDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatWeight(w: number | null, unit: string): string {
  if (w === null) return "";
  return `${w} ${unit}`;
}

function formatExerciseDetail(ex: WorkoutExercise & { exercise: Exercise }): string {
  const parts: string[] = [];
  if (ex.sets !== null) parts.push(`${ex.sets} sets`);
  if (ex.reps !== null) parts.push(`${ex.reps} reps`);
  if (ex.weight !== null) parts.push(`@ ${formatWeight(ex.weight, ex.weight_unit)}`);
  if (ex.time_seconds !== null) parts.push(`${ex.time_seconds}s`);
  if (ex.rpe !== null) parts.push(`RPE ${ex.rpe}`);
  if (ex.rest_seconds !== null) parts.push(`Rest ${ex.rest_seconds}s`);
  return parts.join(" x ").replace("sets x ", "sets x ") || "No details";
}

function formatLastPerformance(last: CompletedExercise | null): string | null {
  if (!last) return null;
  const parts: string[] = [];
  if (last.sets !== null) parts.push(`${last.sets}x`);
  if (last.reps !== null) parts.push(`${last.reps}`);
  if (last.weight !== null) parts.push(`@ ${last.weight} ${last.weight_unit}`);
  if (last.rpe !== null) parts.push(`RPE ${last.rpe}`);
  return parts.length > 0 ? `Last: ${parts.join(" ")}` : null;
}

export default function TodayPage() {
  const today = new Date();
  const dateStr = formatDate(today);
  const [plan, setPlan] = useState<WorkoutPlanWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    fetch(`/api/tempapp/workout-plans/for-date/${dateStr}`)
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("Failed to fetch workout plan");
        return r.json();
      })
      .then((data) => {
        setPlan(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [dateStr]);

  function toggleSkip(exerciseId: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }

  async function completeWorkout() {
    if (!plan) return;
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

      for (const block of plan.blocks) {
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
          workout_plan_id: plan.id,
          date: dateStr,
          exercises,
        }),
      });

      if (!res.ok) throw new Error("Failed to complete workout");
      setCompleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return <p>Loading today&apos;s workout...</p>;
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

      {!plan ? (
        <EmptyState>
          <p>No workout planned for today.</p>
          <Link href="/tempapp/plan" className={styles.goToPlannerLink}>
            Go to Planner &rarr;
          </Link>
        </EmptyState>
      ) : (
        <>
          {plan.blocks.map((block) => (
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
