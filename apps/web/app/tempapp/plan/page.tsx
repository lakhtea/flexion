"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorkoutPlan } from "@/lib/tempapp/types";
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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function PlanPage() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Recurring form
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurringDay, setRecurringDay] = useState(1); // Monday
  const [isBiweekly, setIsBiweekly] = useState(false);
  const [biweeklyStart, setBiweeklyStart] = useState(formatDate(now));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/tempapp/workout-plans")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch plans");
        return r.json();
      })
      .then((data) => {
        setPlans(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Build set of dates that have plans
  const plannedDates = new Set<string>();
  for (const p of plans) {
    if (p.specific_date) {
      plannedDates.add(p.specific_date);
    }
  }

  // Recurring plans
  const recurringPlans = plans.filter((p) => p.day_of_week !== null);

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
      const created = await res.json();
      setPlans((prev) => [...prev, created]);
      setShowRecurringForm(false);
    } catch {
      // silently fail for temp app
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecurring(id: string) {
    if (!confirm("Delete this recurring workout?")) return;
    try {
      await fetch(`/api/tempapp/workout-plans/${id}`, { method: "DELETE" });
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // silent
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

      {/* Calendar */}
      <Card>
        <div className={styles.calendarNav}>
          <Button size="sm" onClick={prevMonth}>&larr;</Button>
          <span className={styles.monthLabel}>{monthName}</span>
          <Button size="sm" onClick={nextMonth}>&rarr;</Button>
        </div>

        {/* Day headers */}
        <div className={styles.dayHeaders}>
          {DAY_NAMES.map((d) => (
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
            const dayOfWeek = new Date(cell.dateStr).getDay();
            const hasRecurring = recurringPlans.some(
              (p) => p.day_of_week === dayOfWeek
            );
            const isToday = cell.dateStr === formatDate(now);

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

      {loading && <p>Loading plans...</p>}

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
                {DAY_NAMES.map((name, i) => (
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
            <div
              key={p.id}
              className={styles.recurringPlanItem}
            >
              <Link
                href={`/tempapp/plan/${p.id}`}
                className={styles.recurringPlanLink}
              >
                <span>
                  Every {DAY_NAMES[p.day_of_week!]}{" "}
                  {p.is_biweekly ? "(biweekly)" : ""}
                </span>
                <span className={styles.editArrow}>Edit &rarr;</span>
              </Link>
              <Button variant="danger" size="sm" onClick={() => deleteRecurring(p.id)}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
