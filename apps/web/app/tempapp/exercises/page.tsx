"use client";

import { useState, useEffect } from "react";
import type { Exercise, ExerciseTrackerContribution } from "@/lib/tempapp/types";

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New exercise form
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEquipment, setNewEquipment] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newDefaultBlock, setNewDefaultBlock] = useState("strength");

  useEffect(() => {
    loadExercises();
  }, []);

  async function loadExercises() {
    setLoading(true);
    try {
      const res = await fetch("/api/tempapp/exercises");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setExercises(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function createExercise() {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/tempapp/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          equipment: newEquipment.trim(),
          context_label: newContext.trim(),
          default_block_type: newDefaultBlock,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setNewName("");
      setNewEquipment("");
      setNewContext("");
      setShowNew(false);
      await loadExercises();
    } catch {
      // silent
    }
  }

  // Filter
  const filtered = exercises
    .filter((e) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q) ||
        e.context_label.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (loading) return <p>Loading exercises...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 className="tempapp-h1" style={{ fontSize: "24px", fontWeight: 700 }}>Exercise Library</h1>
        <button
          className="touch-btn"
          onClick={() => setShowNew(!showNew)}
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          + New Exercise
        </button>
      </div>

      {showNew && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#f3f4f6",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <input
            className="tempapp-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Exercise name"
            style={{ padding: "8px", border: "1px solid #e5e7eb", width: "100%" }}
            autoFocus
          />
          <div className="tempapp-exercise-form-row" style={{ display: "flex", gap: "8px" }}>
            <input
              className="tempapp-input"
              value={newEquipment}
              onChange={(e) => setNewEquipment(e.target.value)}
              placeholder="Equipment (e.g. barbell)"
              style={{ padding: "8px", border: "1px solid #e5e7eb", flex: 1 }}
            />
            <input
              className="tempapp-input"
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              placeholder="Context label (e.g. tempo)"
              style={{ padding: "8px", border: "1px solid #e5e7eb", flex: 1 }}
            />
            <select
              className="tempapp-select"
              value={newDefaultBlock}
              onChange={(e) => setNewDefaultBlock(e.target.value)}
              style={{ padding: "8px", border: "1px solid #e5e7eb" }}
            >
              <option value="warmup">Warmup</option>
              <option value="strength">Strength</option>
              <option value="rehab">Rehab</option>
              <option value="cardio">Cardio</option>
              <option value="stretching">Stretching</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={createExercise}
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
        </div>
      )}

      <input
        className="tempapp-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises..."
        style={{ padding: "8px", border: "1px solid #e5e7eb", width: "100%" }}
      />

      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "white",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {filtered.length === 0 && (
          <p style={{ padding: "16px", color: "#666", fontSize: "14px" }}>
            No exercises found.
          </p>
        )}
        {filtered.map((ex) => (
          <ExerciseRow
            key={ex.id}
            exercise={ex}
            isExpanded={expandedId === ex.id}
            onToggle={() =>
              setExpandedId(expandedId === ex.id ? null : ex.id)
            }
            onReload={loadExercises}
          />
        ))}
      </div>

      <p style={{ fontSize: "12px", color: "#999" }}>
        {filtered.length} exercise{filtered.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function ExerciseRow({
  exercise,
  isExpanded,
  onToggle,
  onReload,
}: {
  exercise: Exercise;
  isExpanded: boolean;
  onToggle: () => void;
  onReload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [equipment, setEquipment] = useState(exercise.equipment);
  const [contextLabel, setContextLabel] = useState(exercise.context_label);
  const [defaultBlock, setDefaultBlock] = useState(exercise.default_block_type);

  // Contributions
  const [contributions, setContributions] = useState<ExerciseTrackerContribution[]>([]);
  const [loadingContribs, setLoadingContribs] = useState(false);
  const [newTrackerKey, setNewTrackerKey] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    if (isExpanded) {
      loadContributions();
    }
  }, [isExpanded]);

  async function loadContributions() {
    setLoadingContribs(true);
    try {
      const res = await fetch(`/api/tempapp/exercises/${exercise.id}/contributions`);
      if (!res.ok) return;
      const data = await res.json();
      setContributions(data);
    } catch {
      // silent
    } finally {
      setLoadingContribs(false);
    }
  }

  async function saveExercise() {
    try {
      await fetch(`/api/tempapp/exercises/${exercise.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          equipment: equipment.trim(),
          context_label: contextLabel.trim(),
          default_block_type: defaultBlock,
        }),
      });
      setEditing(false);
      onReload();
    } catch {
      // silent
    }
  }

  async function deleteExercise() {
    if (!confirm("Delete this exercise?")) return;
    try {
      await fetch(`/api/tempapp/exercises/${exercise.id}`, { method: "DELETE" });
      onReload();
    } catch {
      // silent
    }
  }

  async function addContribution() {
    if (!newTrackerKey.trim() || !newValue) return;
    try {
      await fetch(`/api/tempapp/exercises/${exercise.id}/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracker_key: newTrackerKey.trim(),
          value_per_instance: Number(newValue),
        }),
      });
      setNewTrackerKey("");
      setNewValue("");
      await loadContributions();
    } catch {
      // silent
    }
  }

  async function deleteContribution(id: string) {
    try {
      await fetch(`/api/tempapp/exercises/${exercise.id}/contributions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await loadContributions();
    } catch {
      // silent
    }
  }

  return (
    <div
      style={{
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          gap: "8px",
          cursor: "pointer",
        }}
      >
        <span style={{ fontWeight: 500, flex: 1 }}>{exercise.name}</span>
        {exercise.equipment && (
          <span
            style={{
              fontSize: "11px",
              background: "#e5e7eb",
              padding: "1px 6px",
              color: "#666",
            }}
          >
            {exercise.equipment}
          </span>
        )}
        {exercise.context_label && (
          <span
            style={{
              fontSize: "11px",
              background: "#eff6ff",
              padding: "1px 6px",
              color: "#2563eb",
            }}
          >
            {exercise.context_label}
          </span>
        )}
        <span style={{ fontSize: "12px", color: "#999" }}>
          {isExpanded ? "▲" : "▼"}
        </span>
      </div>

      {isExpanded && (
        <div
          style={{
            padding: "0 16px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Edit fields */}
          {editing ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "12px",
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
              }}
            >
              <input
                className="tempapp-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                style={{ padding: "8px", border: "1px solid #e5e7eb", width: "100%" }}
              />
              <div className="tempapp-exercise-form-row" style={{ display: "flex", gap: "8px" }}>
                <input
                  className="tempapp-input"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  placeholder="Equipment"
                  style={{ padding: "8px", border: "1px solid #e5e7eb", flex: 1 }}
                />
                <input
                  className="tempapp-input"
                  value={contextLabel}
                  onChange={(e) => setContextLabel(e.target.value)}
                  placeholder="Context label"
                  style={{ padding: "8px", border: "1px solid #e5e7eb", flex: 1 }}
                />
                <select
                  className="tempapp-select"
                  value={defaultBlock}
                  onChange={(e) => setDefaultBlock(e.target.value)}
                  style={{ padding: "8px", border: "1px solid #e5e7eb" }}
                >
                  <option value="warmup">Warmup</option>
                  <option value="strength">Strength</option>
                  <option value="rehab">Rehab</option>
                  <option value="cardio">Cardio</option>
                  <option value="stretching">Stretching</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={saveExercise}
                  style={{
                    padding: "8px 16px",
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
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
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: "4px 12px",
                  border: "1px solid #e5e7eb",
                  background: "white",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Edit
              </button>
              <button
                onClick={deleteExercise}
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
          )}

          {/* Tracker contributions */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                background: "#f3f4f6",
                fontWeight: 600,
                fontSize: "13px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              Tracker Contributions
            </div>
            {loadingContribs && (
              <p style={{ padding: "8px 12px", fontSize: "13px" }}>
                Loading...
              </p>
            )}
            {contributions.length === 0 && !loadingContribs && (
              <p
                style={{
                  padding: "8px 12px",
                  fontSize: "13px",
                  color: "#666",
                }}
              >
                No tracker contributions set.
              </p>
            )}
            {contributions.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 12px",
                  borderBottom: "1px solid #e5e7eb",
                  gap: "8px",
                }}
              >
                <span style={{ flex: 1, fontSize: "13px" }}>
                  <strong>{c.tracker_key}</strong>: {c.value_per_instance} per
                  instance
                </span>
                <button
                  onClick={() => deleteContribution(c.id)}
                  style={{
                    padding: "2px 8px",
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "11px",
                  }}
                >
                  X
                </button>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                gap: "8px",
                padding: "8px 12px",
                alignItems: "center",
              }}
            >
              <input
                value={newTrackerKey}
                onChange={(e) => setNewTrackerKey(e.target.value)}
                placeholder="Tracker key (e.g. mileage)"
                style={{
                  padding: "6px",
                  border: "1px solid #e5e7eb",
                  flex: 1,
                  fontSize: "13px",
                }}
              />
              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value"
                type="number"
                style={{
                  padding: "6px",
                  border: "1px solid #e5e7eb",
                  width: "80px",
                  fontSize: "13px",
                }}
              />
              <button
                onClick={addContribution}
                style={{
                  padding: "6px 12px",
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
