"use client";

import { useState, useEffect } from "react";
import type { TrackerGoal, TrackerProgress } from "@/lib/tempapp/types";
import {
  Button,
  Card,
  CardHeader,
  FormField,
  Input,
  FormRow,
  EmptyState,
  ProgressBar,
  PageHeader,
} from "../components";
import styles from "./page.module.css";

function getWeekRange(): { start: string; end: string; display: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => d.toISOString().split("T")[0]!;
  const disp = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return {
    start: fmt(monday),
    end: fmt(sunday),
    display: `${disp(monday)} - ${disp(sunday)}`,
  };
}

export default function TrackerPage() {
  const week = getWeekRange();
  const [progress, setProgress] = useState<TrackerProgress[]>([]);
  const [goals, setGoals] = useState<TrackerGoal[]>([]);
  const [loading, setLoading] = useState(true);

  // New goal form
  const [showNew, setShowNew] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newUnit, setNewUnit] = useState("");

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editUnit, setEditUnit] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [progRes, goalsRes] = await Promise.all([
        fetch("/api/tempapp/tracker-progress"),
        fetch("/api/tempapp/tracker-goals"),
      ]);
      if (progRes.ok) setProgress(await progRes.json());
      if (goalsRes.ok) setGoals(await goalsRes.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function createGoal() {
    if (!newKey.trim() || !newTarget) return;
    try {
      const res = await fetch("/api/tempapp/tracker-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracker_key: newKey.trim(),
          label: newLabel.trim() || newKey.trim(),
          target_value: Number(newTarget),
          unit: newUnit.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewKey("");
      setNewLabel("");
      setNewTarget("");
      setNewUnit("");
      setShowNew(false);
      await loadData();
    } catch {
      // silent
    }
  }

  async function updateGoal(id: string) {
    try {
      await fetch("/api/tempapp/tracker-goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          label: editLabel.trim(),
          target_value: Number(editTarget),
          unit: editUnit.trim(),
        }),
      });
      setEditingId(null);
      await loadData();
    } catch {
      // silent
    }
  }

  async function deleteGoal(id: string) {
    if (!confirm("Delete this goal?")) return;
    try {
      await fetch("/api/tempapp/tracker-goals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await loadData();
    } catch {
      // silent
    }
  }

  if (loading) return <p>Loading tracker...</p>;

  return (
    <div className={styles.page}>
      <div>
        <PageHeader title="Weekly Tracker" />
        <p className={styles.subtitle}>{week.display}</p>
      </div>

      {/* Progress bars */}
      <Card>
        <CardHeader>
          <span>Progress</span>
        </CardHeader>
        {progress.length === 0 && (
          <p className={styles.emptyText}>
            No tracker goals set. Add goals below to track your weekly progress.
          </p>
        )}
        {progress.map((p) => (
          <div key={p.tracker_key} className={styles.progressItem}>
            <ProgressBar
              label={p.label}
              current={p.current_value}
              target={p.target_value}
              unit={p.unit}
            />
          </div>
        ))}
      </Card>

      {/* Goals management */}
      <Card>
        <CardHeader className={styles.goalsHeaderRow}>
          <span>Goals</span>
          <Button variant="primary" size="sm" onClick={() => setShowNew(!showNew)}>
            + New Goal
          </Button>
        </CardHeader>

        {showNew && (
          <div className={styles.newGoalForm}>
            <FormRow wrap mobileColumn>
              <FormField label="Tracker Key" compact>
                <Input
                  compact
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. mileage"
                />
              </FormField>
              <FormField label="Label" compact>
                <Input
                  compact
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Weekly Mileage"
                />
              </FormField>
              <FormField label="Target" compact>
                <Input
                  compact
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  type="number"
                />
              </FormField>
              <FormField label="Unit" compact>
                <Input
                  compact
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="e.g. miles"
                />
              </FormField>
              <FormRow gap="sm">
                <Button variant="primary" size="sm" onClick={createGoal}>
                  Create
                </Button>
                <Button size="sm" onClick={() => setShowNew(false)}>
                  Cancel
                </Button>
              </FormRow>
            </FormRow>
          </div>
        )}

        {goals.length === 0 && (
          <p className={styles.emptyText}>
            No goals configured yet.
          </p>
        )}

        {goals.map((g) => (
          <div key={g.id} className={styles.goalRow}>
            {editingId === g.id ? (
              <>
                <Input
                  compact
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className={styles.editInput}
                />
                <Input
                  compact
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
                  type="number"
                  className={styles.editInputSmall}
                />
                <Input
                  compact
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  className={styles.editInputSmall}
                />
                <Button variant="primary" size="sm" onClick={() => updateGoal(g.id)}>
                  Save
                </Button>
                <Button size="sm" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className={styles.goalLabel}>
                  <strong>{g.label}</strong>{" "}
                  <span className={styles.goalMeta}>
                    ({g.tracker_key}) — {g.target_value} {g.unit}/week
                  </span>
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingId(g.id);
                    setEditLabel(g.label);
                    setEditTarget(String(g.target_value));
                    setEditUnit(g.unit);
                  }}
                >
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => deleteGoal(g.id)}>
                  Delete
                </Button>
              </>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
