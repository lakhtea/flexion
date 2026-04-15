"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkoutPlanWithBlocks } from "@/lib/tempapp/types";
import { displayDate } from "@/lib/tempapp/date-utils";
import PlanEditorClient from "./plan/[date]/PlanEditorClient";
import { Button, Alert, EmptyState } from "./components";
import styles from "./page.module.css";
import Link from "next/link";

interface TodayClientProps {
  initialPlan: WorkoutPlanWithBlocks | null;
  date: string;
}

export default function TodayClient({ initialPlan, date }: TodayClientProps) {
  const router = useRouter();
  const today = new Date(date + "T00:00:00");
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeWorkout() {
    if (!initialPlan) return;
    setCompleting(true);
    try {
      const exercises = initialPlan.blocks.flatMap((block) =>
        block.exercises.map((ex) => ({
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
          skipped: 0,
          sort_order: ex.sort_order,
        }))
      );

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

  return (
    <div className={styles.page}>
      <div className={styles.todayHeader}>
        <div>
          <h1 className={styles.pageTitle}>Today&apos;s Workout</h1>
          <p className={styles.subtitle}>{displayDate(today)}</p>
        </div>
        {initialPlan && !completed && (
          <Button
            variant="success"
            size="lg"
            onClick={completeWorkout}
            disabled={completing}
          >
            {completing ? "Saving..." : "Complete Workout"}
          </Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {completed && <Alert variant="success">Workout completed and recorded!</Alert>}

      {!initialPlan ? (
        <EmptyState>
          <p>No workout planned for today.</p>
          <Link href={`/tempapp/plan/${date}`}>
            <Button variant="primary">Plan Today&apos;s Workout</Button>
          </Link>
        </EmptyState>
      ) : (
        <PlanEditorClient key={initialPlan.id} initialPlan={initialPlan} date={date} embedded />
      )}
    </div>
  );
}
