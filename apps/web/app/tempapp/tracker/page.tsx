"use client";

import { useState, useEffect } from "react";
import type { TrackerGoal, TrackerProgress } from "@/lib/tempapp/types";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 className="tempapp-h1" style={{ fontSize: "24px", fontWeight: 700 }}>Weekly Tracker</h1>
        <p style={{ fontSize: "14px", color: "#666" }}>{week.display}</p>
      </div>

      {/* Progress bars */}
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
            fontWeight: 600,
          }}
        >
          Progress
        </div>
        {progress.length === 0 && (
          <p style={{ padding: "16px", color: "#666", fontSize: "14px" }}>
            No tracker goals set. Add goals below to track your weekly progress.
          </p>
        )}
        {progress.map((p) => {
          const pct = p.target_value > 0 ? Math.min(100, (p.current_value / p.target_value) * 100) : 0;
          const isComplete = pct >= 100;
          return (
            <div
              key={p.tracker_key}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "14px",
                }}
              >
                <span style={{ fontWeight: 500 }}>{p.label}</span>
                <span style={{ color: isComplete ? "#16a34a" : "#666" }}>
                  {p.current_value} / {p.target_value} {p.unit}
                </span>
              </div>
              <div
                style={{
                  height: "16px",
                  background: "#e5e7eb",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: isComplete ? "#16a34a" : "#2563eb",
                    position: "absolute",
                    left: 0,
                    top: 0,
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: "4px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "10px",
                    fontWeight: 600,
                    color: pct > 70 ? "white" : "#333",
                  }}
                >
                  {Math.round(pct)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Goals management */}
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
          <span style={{ fontWeight: 600 }}>Goals</span>
          <button
            className="touch-btn"
            onClick={() => setShowNew(!showNew)}
            style={{
              padding: "8px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            + New Goal
          </button>
        </div>

        {showNew && (
          <div
            className="tempapp-filter-bar"
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #e5e7eb",
              background: "#f3f4f6",
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", color: "#666" }}>Tracker Key</label>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. mileage"
                style={{ padding: "8px", border: "1px solid #e5e7eb", width: "140px" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", color: "#666" }}>Label</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Weekly Mileage"
                style={{ padding: "8px", border: "1px solid #e5e7eb", width: "160px" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", color: "#666" }}>Target</label>
              <input
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                type="number"
                style={{ padding: "8px", border: "1px solid #e5e7eb", width: "80px" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", color: "#666" }}>Unit</label>
              <input
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="e.g. miles"
                style={{ padding: "8px", border: "1px solid #e5e7eb", width: "100px" }}
              />
            </div>
            <button
              onClick={createGoal}
              style={{
                padding: "8px 16px",
                background: "#2563eb",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              Create
            </button>
            <button
              onClick={() => setShowNew(false)}
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
        )}

        {goals.length === 0 && (
          <p style={{ padding: "16px", color: "#666", fontSize: "14px" }}>
            No goals configured yet.
          </p>
        )}

        {goals.map((g) => (
          <div
            key={g.id}
            className="tempapp-goal-row"
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 16px",
              borderBottom: "1px solid #e5e7eb",
              gap: "8px",
            }}
          >
            {editingId === g.id ? (
              <>
                <input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  style={{ padding: "4px 8px", border: "1px solid #e5e7eb", flex: 1 }}
                />
                <input
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
                  type="number"
                  style={{ padding: "4px 8px", border: "1px solid #e5e7eb", width: "80px" }}
                />
                <input
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  style={{ padding: "4px 8px", border: "1px solid #e5e7eb", width: "80px" }}
                />
                <button
                  onClick={() => updateGoal(g.id)}
                  style={{
                    padding: "4px 8px",
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{
                    padding: "4px 8px",
                    border: "1px solid #e5e7eb",
                    background: "white",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: "14px" }}>
                  <strong>{g.label}</strong>{" "}
                  <span style={{ color: "#666" }}>
                    ({g.tracker_key}) — {g.target_value} {g.unit}/week
                  </span>
                </span>
                <button
                  onClick={() => {
                    setEditingId(g.id);
                    setEditLabel(g.label);
                    setEditTarget(String(g.target_value));
                    setEditUnit(g.unit);
                  }}
                  style={{
                    padding: "4px 8px",
                    border: "1px solid #e5e7eb",
                    background: "white",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteGoal(g.id)}
                  style={{
                    padding: "4px 8px",
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
