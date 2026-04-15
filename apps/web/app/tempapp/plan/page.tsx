"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorkoutPlan } from "@/lib/tempapp/types";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <h1 className="tempapp-h1" style={{ fontSize: "24px", fontWeight: 700 }}>Workout Planner</h1>

      {/* Calendar */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "white",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <button
            className="touch-btn"
            onClick={prevMonth}
            style={{
              padding: "8px 16px",
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
            }}
          >
            &larr;
          </button>
          <span style={{ fontWeight: 600, fontSize: "16px" }}>{monthName}</span>
          <button
            className="touch-btn"
            onClick={nextMonth}
            style={{
              padding: "8px 16px",
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
            }}
          >
            &rarr;
          </button>
        </div>

        {/* Day headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              style={{
                padding: "8px",
                textAlign: "center",
                fontSize: "12px",
                fontWeight: 600,
                color: "#666",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
          }}
        >
          {calendarCells.map((cell, i) => {
            if (!cell) {
              return <div key={`empty-${i}`} style={{ padding: "8px" }} />;
            }
            const hasPlanned = plannedDates.has(cell.dateStr);
            // Check if any recurring plan matches this day of week
            const dayOfWeek = new Date(cell.dateStr).getDay();
            const hasRecurring = recurringPlans.some(
              (p) => p.day_of_week === dayOfWeek
            );
            const isToday = cell.dateStr === formatDate(now);

            return (
              <div
                key={cell.dateStr}
                className="tempapp-calendar-cell"
                onClick={() => router.push(`/tempapp/plan/${cell.dateStr}`)}
                style={{
                  padding: "8px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: isToday
                    ? "#eff6ff"
                    : hasPlanned
                      ? "#f0fdf4"
                      : hasRecurring
                        ? "#fefce8"
                        : "white",
                  border: isToday ? "2px solid #2563eb" : "1px solid #f3f4f6",
                  fontSize: "14px",
                  fontWeight: isToday ? 700 : 400,
                  position: "relative",
                }}
              >
                {cell.day}
                {hasPlanned && (
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      background: "#16a34a",
                      borderRadius: "50%",
                      position: "absolute",
                      bottom: "2px",
                      left: "50%",
                      transform: "translateX(-50%)",
                    }}
                  />
                )}
                {!hasPlanned && hasRecurring && (
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      background: "#eab308",
                      borderRadius: "50%",
                      position: "absolute",
                      bottom: "2px",
                      left: "50%",
                      transform: "translateX(-50%)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loading && <p>Loading plans...</p>}

      {/* Recurring workouts section */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "white",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "16px" }}>
            Recurring Workouts
          </span>
          <button
            className="touch-btn"
            onClick={() => setShowRecurringForm(!showRecurringForm)}
            style={{
              padding: "8px 16px",
              border: "1px solid #e5e7eb",
              background: "#2563eb",
              color: "white",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            + New Recurring
          </button>
        </div>

        {showRecurringForm && (
          <div
            style={{
              padding: "16px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "#f3f4f6",
            }}
          >
            <div className="tempapp-recurring-form" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <label style={{ fontSize: "14px", fontWeight: 500 }}>Day:</label>
              <select
                className="tempapp-select"
                value={recurringDay}
                onChange={(e) => setRecurringDay(Number(e.target.value))}
                style={{
                  padding: "8px",
                  border: "1px solid #e5e7eb",
                }}
              >
                {DAY_NAMES.map((name, i) => (
                  <option key={i} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <label style={{ fontSize: "14px" }}>
                <input
                  type="checkbox"
                  checked={isBiweekly}
                  onChange={(e) => setIsBiweekly(e.target.checked)}
                />{" "}
                Biweekly
              </label>
            </div>
            {isBiweekly && (
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <label style={{ fontSize: "14px", fontWeight: 500 }}>
                  Starting:
                </label>
                <input
                  type="date"
                  value={biweeklyStart}
                  onChange={(e) => setBiweeklyStart(e.target.value)}
                  style={{
                    padding: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="touch-btn"
                onClick={createRecurring}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {saving ? "Saving..." : "Create"}
              </button>
              <button
                className="touch-btn"
                onClick={() => setShowRecurringForm(false)}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #e5e7eb",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          {recurringPlans.length === 0 && (
            <p style={{ padding: "16px", color: "#666", fontSize: "14px" }}>
              No recurring workouts set up yet.
            </p>
          )}
          {recurringPlans.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <Link
                href={`/tempapp/plan/${p.id}`}
                style={{
                  textDecoration: "none",
                  color: "#333",
                  flex: 1,
                }}
              >
                <span>
                  Every {DAY_NAMES[p.day_of_week!]}{" "}
                  {p.is_biweekly ? "(biweekly)" : ""}
                </span>
                <span style={{ color: "#2563eb", fontSize: "13px", marginLeft: "8px" }}>
                  Edit &rarr;
                </span>
              </Link>
              <button
                onClick={() => deleteRecurring(p.id)}
                style={{
                  padding: "4px 12px",
                  background: "#dc2626",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
