"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorkoutPlan } from "@/lib/tempapp/types";
import { toDateString, getDaysInMonth, getFirstDayOfWeek } from "@/lib/tempapp/date-utils";
import { DAYS_OF_WEEK_SHORT } from "@/lib/tempapp/constants";
import {
  Button,
  Card,
  CardHeader,
  Input,
  Select,
  FormRow,
  EmptyState,
} from "../components";
import styles from "./plan.module.css";

interface PlanClientProps {
  initialPlans: WorkoutPlan[];
}

export default function PlanClient({ initialPlans }: PlanClientProps) {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [error, setError] = useState<string | null>(null);

  // Recurring form
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurringDay, setRecurringDay] = useState(1); // Monday
  const [isBiweekly, setIsBiweekly] = useState(false);
  const [biweeklyStart, setBiweeklyStart] = useState(toDateString(now));
  const [saving, setSaving] = useState(false);

  const daysInMonth = getDaysInMonth(year, month + 1);
  const firstDay = getFirstDayOfWeek(year, month + 1);

  // Build set of dates that have plans
  const plannedDates = new Set<string>();
  for (const p of initialPlans) {
    if (p.specific_date) {
      plannedDates.add(p.specific_date);
    }
  }

  // Recurring plans
  const recurringPlans = initialPlans.filter((p) => p.day_of_week !== null);

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  }

  async function createRecurring() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        day_of_week: recurringDay,
        is_biweekly: isBiweekly ? 1 : 0,
      };
      if (isBiweekly) {
        body.biweekly_start_date = biweeklyStart;
      }
      const res = await fetch("/api/tempapp/workout-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create recurring plan");
      setShowRecurringForm(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  // Calendar grid cells
  const calendarCells: Array<{ day: number; dateStr: string } | null> = [];
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarCells.push({ day: d, dateStr });
  }

  const monthName = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Workout Planner</h1>

      {error && (
        <div style={{ color: "red", marginBottom: "0.5rem" }}>{error}</div>
      )}

      {/* Calendar */}
      <Card>
        <div className={styles.calendarNav}>
          <Button size="sm" onClick={prevMonth}>&larr;</Button>
          <span className={styles.monthLabel}>{monthName}</span>
          <Button size="sm" onClick={nextMonth}>&rarr;</Button>
        </div>

        {/* Day headers */}
        <div className={styles.dayHeaders}>
          {DAYS_OF_WEEK_SHORT.map((d) => (
            <div key={d} className={styles.dayHeader}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className={styles.dayGrid}>
          {calendarCells.map((cell, i) => {
            if (!cell) {
              return <div key={`empty-${i}`} className={styles.dayCellEmpty} />;
            }
            const hasPlanned = plannedDates.has(cell.dateStr);
            const dayOfWeek = new Date(cell.dateStr + "T00:00:00").getDay();
            const hasRecurring = recurringPlans.some(
              (p) => p.day_of_week === dayOfWeek
            );
            const isToday = cell.dateStr === toDateString(now);

            const cellClass = isToday
              ? styles.dayCellToday
              : hasPlanned
                ? styles.dayCellPlanned
                : hasRecurring
                  ? styles.dayCellRecurring
                  : styles.dayCell;

            return (
              <div
                key={cell.dateStr}
                className={cellClass}
                onClick={() => router.push(`/tempapp/plan/${cell.dateStr}`)}
              >
                {cell.day}
                {hasPlanned && <div className={styles.dotPlanned} />}
                {!hasPlanned && hasRecurring && <div className={styles.dotRecurring} />}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recurring workouts section */}
      <Card>
        <CardHeader>
          <div className={styles.recurringHeader}>
            <span className={styles.sectionTitle}>
              Recurring Workouts
            </span>
            <Button variant="primary" size="sm" onClick={() => setShowRecurringForm(!showRecurringForm)}>
              + New Recurring
            </Button>
          </div>
        </CardHeader>

        {showRecurringForm && (
          <div className={styles.recurringForm}>
            <div className={styles.recurringRow}>
              <label className={styles.recurringLabel}>Day:</label>
              <Select
                compact
                value={recurringDay}
                onChange={(e) => setRecurringDay(Number(e.target.value))}
              >
                {DAYS_OF_WEEK_SHORT.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </Select>
            </div>
            <FormRow center>
              <label className={styles.biweeklyLabel}>
                <input
                  type="checkbox"
                  checked={isBiweekly}
                  onChange={(e) => setIsBiweekly(e.target.checked)}
                />{" "}
                Biweekly
              </label>
            </FormRow>
            {isBiweekly && (
              <FormRow center>
                <label className={styles.recurringLabel}>Starting:</label>
                <Input
                  compact
                  type="date"
                  value={biweeklyStart}
                  onChange={(e) => setBiweeklyStart(e.target.value)}
                />
              </FormRow>
            )}
            <FormRow>
              <Button variant="primary" onClick={createRecurring} disabled={saving}>
                {saving ? "Saving..." : "Create"}
              </Button>
              <Button onClick={() => setShowRecurringForm(false)}>
                Cancel
              </Button>
            </FormRow>
          </div>
        )}

        <div>
          {recurringPlans.length === 0 && (
            <p className={styles.emptyRecurring}>
              No recurring workouts set up yet.
            </p>
          )}
          {recurringPlans.map((p) => (
            <Link
              key={p.id}
              href={`/tempapp/plan/${p.id}`}
              className={styles.recurringPlanLink}
            >
              <span>
                Every {DAYS_OF_WEEK_SHORT[p.day_of_week!]}{" "}
                {p.is_biweekly ? "(biweekly)" : ""}
              </span>
              <span className={styles.editArrow}>Edit &rarr;</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
