"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import type {
  WorkoutPlanWithBlocks,
  WorkoutBlockWithExercises,
  WorkoutExercise,
  Exercise,
  BLOCK_TYPES,
} from "@/lib/tempapp/types";

const BLOCK_TYPE_OPTIONS: Array<(typeof BLOCK_TYPES)[number]> = [
  "warmup",
  "strength",
  "rehab",
  "cardio",
  "stretching",
  "custom",
];

export default function PlanEditorPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = use(params);
  const [plan, setPlan] = useState<WorkoutPlanWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add block form
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockType, setNewBlockType] = useState<string>("strength");
  const [newBlockName, setNewBlockName] = useState("");

  // Routine picker
  const [showRoutinePicker, setShowRoutinePicker] = useState(false);
  const [routines, setRoutines] = useState<Array<{ id: string; name: string; description: string }>>([]);

  useEffect(() => {
    loadPlan();
  }, [date]);

  async function loadPlan() {
    setLoading(true);
    try {
      // First try loading as a specific date plan
      let res = await fetch(`/api/tempapp/workout-plans/for-date/${date}`);
      if (res.status === 404) {
        // Try loading by ID (for recurring plans)
        res = await fetch(`/api/tempapp/workout-plans/${date}`);
      }
      if (res.status === 404) {
        // Create a new plan for this date
        const createRes = await fetch("/api/tempapp/workout-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ specific_date: date }),
        });
        if (!createRes.ok) throw new Error("Failed to create plan");
        const created = await createRes.json();
        setPlan({ ...created, blocks: [] });
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load plan");
      const data = await res.json();
      setPlan(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function addBlock() {
    if (!plan) return;
    const name = newBlockName || newBlockType.charAt(0).toUpperCase() + newBlockType.slice(1);
    try {
      const res = await fetch(`/api/tempapp/workout-plans/${plan.id}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          block_type: newBlockType,
          sort_order: plan.blocks.length,
        }),
      });
      if (!res.ok) throw new Error("Failed to add block");
      setShowAddBlock(false);
      setNewBlockName("");
      await loadPlan();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function deleteBlock(blockId: string) {
    try {
      const res = await fetch(`/api/tempapp/workout-blocks/${blockId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete block");
      await loadPlan();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function moveBlock(blockId: string, direction: "up" | "down") {
    if (!plan) return;
    const idx = plan.blocks.findIndex((b) => b.id === blockId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= plan.blocks.length) return;

    const ordered = plan.blocks.map((b, i) => {
      if (i === idx) return { id: b.id, sort_order: swapIdx };
      if (i === swapIdx) return { id: b.id, sort_order: idx };
      return { id: b.id, sort_order: i };
    });

    try {
      await fetch("/api/tempapp/workout-blocks/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: ordered }),
      });
      await loadPlan();
    } catch {
      // silent
    }
  }

  async function loadRoutines() {
    try {
      const res = await fetch("/api/tempapp/routines");
      if (!res.ok) return;
      const data = await res.json();
      setRoutines(data);
      setShowRoutinePicker(true);
    } catch {
      // silent
    }
  }

  async function applyRoutine(routineId: string) {
    if (!plan) return;
    try {
      const res = await fetch(`/api/tempapp/routines/${routineId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workout_plan_id: plan.id }),
      });
      if (!res.ok) throw new Error("Failed to apply routine");
      setShowRoutinePicker(false);
      await loadPlan();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  // Determine display title
  const isUUID = date.includes("-") && date.length > 10;
  const title = isUUID ? "Recurring Workout" : `Workout for ${date}`;

  if (loading) return <p>Loading plan...</p>;
  if (error) return <p style={{ color: "#dc2626" }}>Error: {error}</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className="tempapp-plan-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Link
            href="/tempapp/plan"
            style={{ color: "#2563eb", textDecoration: "none", fontSize: "13px" }}
          >
            &larr; Back to Planner
          </Link>
          <h1 className="tempapp-h1" style={{ fontSize: "24px", fontWeight: 700 }}>{title}</h1>
        </div>
        <div className="tempapp-plan-header-actions" style={{ display: "flex", gap: "8px" }}>
          <button
            className="touch-btn"
            onClick={loadRoutines}
            style={{
              padding: "8px 16px",
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Add from Routine
          </button>
          <button
            className="touch-btn"
            onClick={() => setShowAddBlock(true)}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "#2563eb",
              color: "white",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            + Add Block
          </button>
        </div>
      </div>

      {/* Routine picker */}
      {showRoutinePicker && (
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>Select a Routine</span>
            <button
              onClick={() => setShowRoutinePicker(false)}
              style={{
                padding: "4px 8px",
                border: "1px solid #e5e7eb",
                background: "white",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
          {routines.length === 0 && (
            <p style={{ color: "#666", fontSize: "14px" }}>No routines available.</p>
          )}
          {routines.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "white",
                border: "1px solid #e5e7eb",
              }}
            >
              <div>
                <span style={{ fontWeight: 500 }}>{r.name}</span>
                {r.description && (
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    {" "}
                    - {r.description}
                  </span>
                )}
              </div>
              <button
                onClick={() => applyRoutine(r.id)}
                style={{
                  padding: "4px 12px",
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Apply
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add block form */}
      {showAddBlock && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#f3f4f6",
            padding: "16px",
            display: "flex",
            gap: "8px",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500 }}>Type</label>
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
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
            <label style={{ fontSize: "12px", fontWeight: 500 }}>
              Name (optional)
            </label>
            <input
              value={newBlockName}
              onChange={(e) => setNewBlockName(e.target.value)}
              placeholder={newBlockType.charAt(0).toUpperCase() + newBlockType.slice(1)}
              style={{ padding: "8px", border: "1px solid #e5e7eb", width: "100%" }}
            />
          </div>
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
      {plan && plan.blocks.length === 0 && (
        <div
          style={{
            padding: "24px",
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            textAlign: "center",
            color: "#666",
          }}
        >
          No blocks yet. Add a block to start building this workout.
        </div>
      )}

      {plan &&
        plan.blocks.map((block, idx) => (
          <BlockEditor
            key={block.id}
            block={block}
            planId={plan.id}
            isFirst={idx === 0}
            isLast={idx === plan.blocks.length - 1}
            onMoveUp={() => moveBlock(block.id, "up")}
            onMoveDown={() => moveBlock(block.id, "down")}
            onDelete={() => deleteBlock(block.id)}
            onReload={loadPlan}
          />
        ))}
    </div>
  );
}

function BlockEditor({
  block,
  planId,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onReload,
}: {
  block: WorkoutBlockWithExercises;
  planId: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onReload: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [blockName, setBlockName] = useState(block.name);
  const [showAddExercise, setShowAddExercise] = useState(false);

  async function saveName() {
    try {
      await fetch(`/api/tempapp/workout-blocks/${block.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: blockName }),
      });
      setEditingName(false);
      onReload();
    } catch {
      // silent
    }
  }

  async function moveExercise(exerciseId: string, direction: "up" | "down") {
    const idx = block.exercises.findIndex((e) => e.id === exerciseId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= block.exercises.length) return;

    const ordered = block.exercises.map((e, i) => {
      if (i === idx) return { id: e.id, sort_order: swapIdx };
      if (i === swapIdx) return { id: e.id, sort_order: idx };
      return { id: e.id, sort_order: i };
    });

    try {
      await fetch("/api/tempapp/workout-exercises/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercises: ordered }),
      });
      onReload();
    } catch {
      // silent
    }
  }

  async function deleteExercise(exerciseId: string) {
    try {
      await fetch(`/api/tempapp/workout-exercises/${exerciseId}`, {
        method: "DELETE",
      });
      onReload();
    } catch {
      // silent
    }
  }

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        background: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Block header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid #e5e7eb",
          background: "#f3f4f6",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            style={{
              padding: "2px 6px",
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: isFirst ? "default" : "pointer",
              opacity: isFirst ? 0.3 : 1,
              fontSize: "12px",
            }}
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            style={{
              padding: "2px 6px",
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: isLast ? "default" : "pointer",
              opacity: isLast ? 0.3 : 1,
              fontSize: "12px",
            }}
          >
            ▼
          </button>
        </div>

        {editingName ? (
          <div style={{ display: "flex", gap: "4px", flex: 1 }}>
            <input
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              style={{ padding: "4px 8px", border: "1px solid #e5e7eb", flex: 1 }}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
            />
            <button
              onClick={saveName}
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
          </div>
        ) : (
          <span
            style={{ fontWeight: 600, flex: 1, cursor: "pointer" }}
            onClick={() => setEditingName(true)}
          >
            {block.name}
            <span style={{ fontSize: "11px", color: "#666" }}>
              {" "}
              ({block.block_type})
            </span>
          </span>
        )}

        <button
          onClick={onDelete}
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
      </div>

      {/* Exercises */}
      {block.exercises.map((ex, idx) => (
        <ExerciseEditor
          key={ex.id}
          ex={ex}
          isFirst={idx === 0}
          isLast={idx === block.exercises.length - 1}
          onMoveUp={() => moveExercise(ex.id, "up")}
          onMoveDown={() => moveExercise(ex.id, "down")}
          onDelete={() => deleteExercise(ex.id)}
          onReload={onReload}
        />
      ))}

      {/* Add exercise */}
      <div style={{ padding: "12px 16px" }}>
        {showAddExercise ? (
          <ExerciseSearch
            blockId={block.id}
            sortOrder={block.exercises.length}
            onDone={() => {
              setShowAddExercise(false);
              onReload();
            }}
            onCancel={() => setShowAddExercise(false)}
          />
        ) : (
          <button
            className="touch-btn"
            onClick={() => setShowAddExercise(true)}
            style={{
              padding: "8px 16px",
              border: "1px dashed #e5e7eb",
              background: "white",
              cursor: "pointer",
              color: "#2563eb",
              width: "100%",
              fontSize: "13px",
            }}
          >
            + Add Exercise
          </button>
        )}
      </div>
    </div>
  );
}

function ExerciseSearch({
  blockId,
  sortOrder,
  onDone,
  onCancel,
}: {
  blockId: string;
  sortOrder: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEquipment, setNewEquipment] = useState("");
  const [newContext, setNewContext] = useState("");

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/tempapp/exercises?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then(setResults)
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  async function addExercise(exerciseId: string) {
    try {
      await fetch(`/api/tempapp/workout-blocks/${blockId}/exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_id: exerciseId,
          sort_order: sortOrder,
        }),
      });
      onDone();
    } catch {
      // silent
    }
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/tempapp/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          equipment: newEquipment.trim(),
          context_label: newContext.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to create exercise");
      const created = await res.json();
      await addExercise(created.id);
    } catch {
      // silent
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          className="tempapp-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises..."
          style={{ padding: "8px", border: "1px solid #e5e7eb", flex: 1 }}
          autoFocus
        />
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
            background: "white",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          New
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
            background: "white",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          Cancel
        </button>
      </div>

      {results.length > 0 && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "white",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {results.map((ex) => (
            <div
              key={ex.id}
              onClick={() => addExercise(ex.id)}
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #e5e7eb",
                cursor: "pointer",
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 500 }}>{ex.name}</span>
              {ex.equipment && (
                <span
                  style={{
                    fontSize: "11px",
                    background: "#e5e7eb",
                    padding: "1px 6px",
                    color: "#666",
                  }}
                >
                  {ex.equipment}
                </span>
              )}
              {ex.context_label && (
                <span style={{ fontSize: "11px", color: "#666" }}>
                  ({ex.context_label})
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#f3f4f6",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Exercise name"
            style={{ padding: "8px", border: "1px solid #e5e7eb", width: "100%" }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={newEquipment}
              onChange={(e) => setNewEquipment(e.target.value)}
              placeholder="Equipment (e.g. barbell)"
              style={{ padding: "8px", border: "1px solid #e5e7eb", flex: 1 }}
            />
            <input
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              placeholder="Context (e.g. tempo)"
              style={{ padding: "8px", border: "1px solid #e5e7eb", flex: 1 }}
            />
          </div>
          <button
            onClick={createAndAdd}
            style={{
              padding: "8px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Create &amp; Add
          </button>
        </div>
      )}
    </div>
  );
}

function ExerciseEditor({
  ex,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onReload,
}: {
  ex: WorkoutExercise & { exercise: Exercise };
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onReload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [sets, setSets] = useState(ex.sets?.toString() ?? "");
  const [reps, setReps] = useState(ex.reps ?? "");
  const [weight, setWeight] = useState(ex.weight?.toString() ?? "");
  const [weightUnit, setWeightUnit] = useState(ex.weight_unit || "lbs");
  const [timeSeconds, setTimeSeconds] = useState(ex.time_seconds?.toString() ?? "");
  const [rpe, setRpe] = useState(ex.rpe?.toString() ?? "");
  const [restSeconds, setRestSeconds] = useState(ex.rest_seconds?.toString() ?? "");
  const [isSupersetWithNext, setIsSupersetWithNext] = useState(!!ex.is_superset_with_next);
  const [reminder, setReminder] = useState(ex.reminder ?? "");
  const [comment, setComment] = useState(ex.comment ?? "");

  async function save() {
    try {
      await fetch(`/api/tempapp/workout-exercises/${ex.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sets: sets ? Number(sets) : null,
          reps: reps || null,
          weight: weight ? Number(weight) : null,
          weight_unit: weightUnit,
          time_seconds: timeSeconds ? Number(timeSeconds) : null,
          rpe: rpe ? Number(rpe) : null,
          rest_seconds: restSeconds ? Number(restSeconds) : null,
          is_superset_with_next: isSupersetWithNext ? 1 : 0,
          reminder: reminder || null,
          comment: comment.slice(0, 50) || null,
        }),
      });
      setEditing(false);
      onReload();
    } catch {
      // silent
    }
  }

  const detailParts: string[] = [];
  if (ex.sets !== null) detailParts.push(`${ex.sets}x`);
  if (ex.reps !== null) detailParts.push(ex.reps);
  if (ex.weight !== null) detailParts.push(`@ ${ex.weight} ${ex.weight_unit}`);
  if (ex.time_seconds !== null) detailParts.push(`${ex.time_seconds}s`);
  if (ex.rpe !== null) detailParts.push(`RPE ${ex.rpe}`);
  if (ex.rest_seconds !== null) detailParts.push(`Rest ${ex.rest_seconds}s`);

  const fieldStyle: React.CSSProperties = {
    padding: "8px",
    border: "1px solid #e5e7eb",
    width: "100%",
  };

  const smallFieldStyle: React.CSSProperties = {
    ...fieldStyle,
    width: "80px",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "12px 16px",
        borderBottom: "1px solid #e5e7eb",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ display: "flex", gap: "2px" }}>
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            style={{
              padding: "1px 4px",
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: isFirst ? "default" : "pointer",
              opacity: isFirst ? 0.3 : 1,
              fontSize: "10px",
            }}
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            style={{
              padding: "1px 4px",
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: isLast ? "default" : "pointer",
              opacity: isLast ? 0.3 : 1,
              fontSize: "10px",
            }}
          >
            ▼
          </button>
        </div>
        <span style={{ fontWeight: 600, flex: 1 }}>
          {ex.exercise.name}
          {ex.exercise.equipment && (
            <span
              style={{
                fontSize: "11px",
                background: "#e5e7eb",
                padding: "1px 6px",
                color: "#666",
              }}
            >
              {" "}
              {ex.exercise.equipment}
            </span>
          )}
        </span>
        {!editing && (
          <span style={{ fontSize: "13px", color: "#666" }}>
            {detailParts.join(" ")}
          </span>
        )}
        <button
          onClick={() => setEditing(!editing)}
          style={{
            padding: "4px 8px",
            border: "1px solid #e5e7eb",
            background: "white",
            cursor: "pointer",
            fontSize: "11px",
          }}
        >
          {editing ? "Close" : "Edit"}
        </button>
        <button
          onClick={onDelete}
          style={{
            padding: "4px 8px",
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

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="tempapp-field-row">
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", color: "#666" }}>Sets</label>
              <input
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                type="number"
                style={smallFieldStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", color: "#666" }}>Reps</label>
              <input
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="e.g. 8-12"
                style={smallFieldStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", color: "#666" }}>Weight</label>
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                type="number"
                style={smallFieldStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", color: "#666" }}>Unit</label>
              <select
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value)}
                style={{ padding: "8px", border: "1px solid #e5e7eb" }}
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
                <option value="bw">bw</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", color: "#666" }}>Time (s)</label>
              <input
                value={timeSeconds}
                onChange={(e) => setTimeSeconds(e.target.value)}
                type="number"
                style={smallFieldStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", color: "#666" }}>RPE</label>
              <input
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                type="number"
                min="1"
                max="10"
                style={smallFieldStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", color: "#666" }}>Rest (s)</label>
              <input
                value={restSeconds}
                onChange={(e) => setRestSeconds(e.target.value)}
                type="number"
                style={smallFieldStyle}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <label style={{ fontSize: "12px" }}>
              <input
                type="checkbox"
                checked={isSupersetWithNext}
                onChange={(e) => setIsSupersetWithNext(e.target.checked)}
              />{" "}
              Superset with next
            </label>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
              <label style={{ fontSize: "11px", color: "#666" }}>Reminder</label>
              <input
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
                placeholder="e.g. squeeze at top"
                style={fieldStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
              <label style={{ fontSize: "11px", color: "#666" }}>
                Comment (max 50)
              </label>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 50))}
                maxLength={50}
                style={fieldStyle}
              />
            </div>
          </div>
          <button
            className="touch-btn"
            onClick={save}
            style={{
              padding: "8px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
