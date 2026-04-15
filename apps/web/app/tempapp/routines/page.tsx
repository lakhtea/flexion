"use client";

import { useState, useEffect } from "react";
import type { Routine, Exercise } from "@/lib/tempapp/types";

interface RoutineBlockWithExercises {
  id: string;
  routine_id: string;
  name: string;
  block_type: string;
  sort_order: number;
  exercises: Array<{
    id: string;
    routine_block_id: string;
    exercise_id: string;
    exercise?: Exercise;
    sets: number | null;
    reps: string | null;
    weight: number | null;
    weight_unit: string;
    time_seconds: number | null;
    rpe: number | null;
    rest_seconds: number | null;
    is_superset_with_next: number;
    sort_order: number;
  }>;
}

interface RoutineWithBlocks extends Routine {
  blocks: RoutineBlockWithExercises[];
}

const BLOCK_TYPE_OPTIONS = [
  "warmup",
  "strength",
  "rehab",
  "cardio",
  "stretching",
  "custom",
];

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<RoutineWithBlocks[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New routine form
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Apply to workout
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyDate, setApplyDate] = useState("");

  useEffect(() => {
    loadRoutines();
  }, []);

  async function loadRoutines() {
    setLoading(true);
    try {
      const res = await fetch("/api/tempapp/routines");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setRoutines(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function createRoutine() {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/tempapp/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewName("");
      setNewDesc("");
      setShowNew(false);
      await loadRoutines();
    } catch {
      // silent
    }
  }

  async function deleteRoutine(id: string) {
    if (!confirm("Delete this routine?")) return;
    try {
      await fetch(`/api/tempapp/routines/${id}`, { method: "DELETE" });
      await loadRoutines();
    } catch {
      // silent
    }
  }

  async function applyToWorkout(routineId: string) {
    if (!applyDate) return;
    try {
      // First ensure a plan exists for the date
      let planRes = await fetch(`/api/tempapp/workout-plans/for-date/${applyDate}`);
      let planId: string;

      if (planRes.status === 404) {
        const createRes = await fetch("/api/tempapp/workout-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ specific_date: applyDate }),
        });
        if (!createRes.ok) throw new Error("Failed to create plan");
        const created = await createRes.json();
        planId = created.id;
      } else {
        const plan = await planRes.json();
        planId = plan.id;
      }

      // Apply routine
      const res = await fetch(`/api/tempapp/routines/${routineId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workout_plan_id: planId }),
      });
      if (!res.ok) throw new Error("Failed to apply");
      setApplyingId(null);
      setApplyDate("");
      alert("Routine applied to workout!");
    } catch {
      // silent
    }
  }

  if (loading) return <p>Loading routines...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 className="tempapp-h1" style={{ fontSize: "24px", fontWeight: 700 }}>Routines</h1>
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
          + New Routine
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
            placeholder="Routine name"
            style={{ padding: "8px", border: "1px solid #e5e7eb", width: "100%" }}
            autoFocus
          />
          <input
            className="tempapp-input"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            style={{ padding: "8px", border: "1px solid #e5e7eb", width: "100%" }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={createRoutine}
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

      {routines.length === 0 && (
        <div
          style={{
            padding: "24px",
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            textAlign: "center",
            color: "#666",
          }}
        >
          No routines yet. Create one to save reusable workout templates.
        </div>
      )}

      {routines.map((routine) => (
        <div
          key={routine.id}
          style={{
            border: "1px solid #e5e7eb",
            background: "white",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            onClick={() =>
              setExpandedId(expandedId === routine.id ? null : routine.id)
            }
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 16px",
              gap: "8px",
              cursor: "pointer",
              borderBottom:
                expandedId === routine.id ? "1px solid #e5e7eb" : "none",
            }}
          >
            <span style={{ fontWeight: 600, flex: 1, fontSize: "16px" }}>
              {routine.name}
            </span>
            {routine.description && (
              <span style={{ color: "#666", fontSize: "13px" }}>
                {routine.description}
              </span>
            )}
            <span style={{ fontSize: "12px", color: "#999" }}>
              {routine.blocks?.length ?? 0} block
              {(routine.blocks?.length ?? 0) !== 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: "12px", color: "#999" }}>
              {expandedId === routine.id ? "▲" : "▼"}
            </span>
          </div>

          {expandedId === routine.id && (
            <RoutineDetail
              routine={routine}
              onReload={loadRoutines}
              onDelete={() => deleteRoutine(routine.id)}
              applyingId={applyingId}
              applyDate={applyDate}
              onSetApplyingId={setApplyingId}
              onSetApplyDate={setApplyDate}
              onApply={() => applyToWorkout(routine.id)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function RoutineDetail({
  routine,
  onReload,
  onDelete,
  applyingId,
  applyDate,
  onSetApplyingId,
  onSetApplyDate,
  onApply,
}: {
  routine: RoutineWithBlocks;
  onReload: () => void;
  onDelete: () => void;
  applyingId: string | null;
  applyDate: string;
  onSetApplyingId: (id: string | null) => void;
  onSetApplyDate: (date: string) => void;
  onApply: () => void;
}) {
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockType, setNewBlockType] = useState("strength");
  const [newBlockName, setNewBlockName] = useState("");

  // Exercise search per block
  const [addingExToBlock, setAddingExToBlock] = useState<string | null>(null);
  const [exQuery, setExQuery] = useState("");
  const [exResults, setExResults] = useState<Exercise[]>([]);

  useEffect(() => {
    if (!exQuery || exQuery.length < 1) {
      setExResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/tempapp/exercises?q=${encodeURIComponent(exQuery)}`)
        .then((r) => r.json())
        .then(setExResults)
        .catch(() => setExResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [exQuery]);

  async function addBlock() {
    const name =
      newBlockName ||
      newBlockType.charAt(0).toUpperCase() + newBlockType.slice(1);
    try {
      // Using routine-specific block API (assumed pattern similar to workout plans)
      await fetch(`/api/tempapp/routines/${routine.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          add_block: {
            name,
            block_type: newBlockType,
            sort_order: routine.blocks?.length ?? 0,
          },
        }),
      });
      setShowAddBlock(false);
      setNewBlockName("");
      onReload();
    } catch {
      // silent
    }
  }

  async function addExToBlock(blockId: string, exerciseId: string) {
    try {
      await fetch(`/api/tempapp/routines/${routine.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          add_exercise: {
            routine_block_id: blockId,
            exercise_id: exerciseId,
            sort_order:
              routine.blocks?.find((b) => b.id === blockId)?.exercises
                ?.length ?? 0,
          },
        }),
      });
      setAddingExToBlock(null);
      setExQuery("");
      onReload();
    } catch {
      // silent
    }
  }

  const isApplying = applyingId === routine.id;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "16px",
      }}
    >
      {/* Action buttons */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          onClick={() => onSetApplyingId(isApplying ? null : routine.id)}
          style={{
            padding: "8px 16px",
            background: "#16a34a",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Apply to Workout
        </button>
        <button
          onClick={() => setShowAddBlock(true)}
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          + Add Block
        </button>
        <button
          onClick={onDelete}
          style={{
            padding: "8px 16px",
            background: "#dc2626",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Delete Routine
        </button>
      </div>

      {/* Apply form */}
      {isApplying && (
        <div
          className="tempapp-apply-form"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
            padding: "12px",
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
          }}
        >
          <label style={{ fontSize: "13px" }}>Apply to date:</label>
          <input
            className="tempapp-input"
            type="date"
            value={applyDate}
            onChange={(e) => onSetApplyDate(e.target.value)}
            style={{ padding: "8px", border: "1px solid #e5e7eb" }}
          />
          <button
            onClick={onApply}
            disabled={!applyDate}
            style={{
              padding: "8px 16px",
              background: applyDate ? "#16a34a" : "#e5e7eb",
              color: "white",
              border: "none",
              cursor: applyDate ? "pointer" : "default",
            }}
          >
            Apply
          </button>
          <button
            onClick={() => onSetApplyingId(null)}
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

      {/* Add block form */}
      {showAddBlock && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "flex-end",
            padding: "12px",
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
          }}
        >
          <select
            value={newBlockType}
            onChange={(e) => setNewBlockType(e.target.value)}
            style={{ padding: "8px", border: "1px solid #e5e7eb" }}
          >
            {BLOCK_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <input
            value={newBlockName}
            onChange={(e) => setNewBlockName(e.target.value)}
            placeholder="Block name (optional)"
            style={{ padding: "8px", border: "1px solid #e5e7eb", flex: 1 }}
          />
          <button
            onClick={addBlock}
            style={{
              padding: "8px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Add
          </button>
          <button
            onClick={() => setShowAddBlock(false)}
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

      {/* Blocks */}
      {(!routine.blocks || routine.blocks.length === 0) && (
        <p style={{ color: "#666", fontSize: "14px" }}>
          No blocks in this routine yet.
        </p>
      )}

      {routine.blocks?.map((block) => (
        <div
          key={block.id}
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
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 600, flex: 1 }}>{block.name}</span>
            <span
              style={{
                fontSize: "11px",
                background: "#e5e7eb",
                padding: "1px 6px",
              }}
            >
              {block.block_type}
            </span>
          </div>

          {block.exercises?.map((ex) => (
            <div
              key={ex.id}
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                gap: "8px",
                alignItems: "center",
                fontSize: "13px",
              }}
            >
              <span style={{ fontWeight: 500 }}>
                {ex.exercise?.name ?? "Unknown"}
              </span>
              {ex.sets !== null && <span>{ex.sets}x</span>}
              {ex.reps !== null && <span>{ex.reps}</span>}
              {ex.weight !== null && (
                <span>
                  @ {ex.weight} {ex.weight_unit}
                </span>
              )}
            </div>
          ))}

          {/* Add exercise to block */}
          {addingExToBlock === block.id ? (
            <div
              style={{
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={exQuery}
                  onChange={(e) => setExQuery(e.target.value)}
                  placeholder="Search exercises..."
                  style={{
                    padding: "6px",
                    border: "1px solid #e5e7eb",
                    flex: 1,
                    fontSize: "13px",
                  }}
                  autoFocus
                />
                <button
                  onClick={() => {
                    setAddingExToBlock(null);
                    setExQuery("");
                  }}
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
              </div>
              {exResults.length > 0 && (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    maxHeight: "150px",
                    overflowY: "auto",
                  }}
                >
                  {exResults.map((ex) => (
                    <div
                      key={ex.id}
                      onClick={() => addExToBlock(block.id, ex.id)}
                      style={{
                        padding: "6px 8px",
                        borderBottom: "1px solid #e5e7eb",
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      {ex.name}{" "}
                      {ex.equipment && (
                        <span style={{ color: "#666" }}>({ex.equipment})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "8px 12px" }}>
              <button
                onClick={() => setAddingExToBlock(block.id)}
                style={{
                  padding: "4px 12px",
                  border: "1px dashed #e5e7eb",
                  background: "white",
                  cursor: "pointer",
                  color: "#2563eb",
                  fontSize: "12px",
                  width: "100%",
                }}
              >
                + Add Exercise
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
