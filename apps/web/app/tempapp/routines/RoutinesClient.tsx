"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoutineWithBlocks, Exercise } from "@/lib/tempapp/types";
import { BLOCK_TYPES } from "@/lib/tempapp/types";
import { useExerciseSearch } from "../hooks/use-exercise-search";
import {
  Button,
  Card,
  CardHeader,
  Badge,
  Input,
  Select,
  FormRow,
  EmptyState,
  PageHeader,
} from "../components";
import styles from "./page.module.css";

interface RoutinesClientProps {
  initialRoutines: RoutineWithBlocks[];
}

export default function RoutinesClient({ initialRoutines }: RoutinesClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New routine form
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Apply to workout
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyDate, setApplyDate] = useState("");

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
      if (!res.ok) throw new Error("Failed to create routine");
      setNewName("");
      setNewDesc("");
      setShowNew(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create routine");
    }
  }

  async function deleteRoutine(id: string) {
    if (!confirm("Delete this routine?")) return;
    try {
      const res = await fetch(`/api/tempapp/routines/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete routine");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete routine");
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
      if (!res.ok) throw new Error("Failed to apply routine");
      setApplyingId(null);
      setApplyDate("");
      alert("Routine applied to workout!");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply routine");
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Routines">
        <Button variant="primary" onClick={() => setShowNew(!showNew)}>
          + New Routine
        </Button>
      </PageHeader>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {showNew && (
        <Card>
          <div className={styles.newRoutineForm}>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Routine name"
              autoFocus
            />
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
            />
            <FormRow gap="sm">
              <Button variant="primary" onClick={createRoutine}>
                Create
              </Button>
              <Button onClick={() => setShowNew(false)}>
                Cancel
              </Button>
            </FormRow>
          </div>
        </Card>
      )}

      {initialRoutines.length === 0 && (
        <EmptyState>
          No routines yet. Create one to save reusable workout templates.
        </EmptyState>
      )}

      {initialRoutines.map((routine) => (
        <Card key={routine.id}>
          {/* Header */}
          <div
            onClick={() =>
              setExpandedId(expandedId === routine.id ? null : routine.id)
            }
            className={
              expandedId === routine.id
                ? styles.routineHeaderExpanded
                : styles.routineHeader
            }
          >
            <span className={styles.routineName}>
              {routine.name}
            </span>
            {routine.description && (
              <span className={styles.routineDesc}>
                {routine.description}
              </span>
            )}
            <span className={styles.routineMeta}>
              {routine.blocks?.length ?? 0} block
              {(routine.blocks?.length ?? 0) !== 1 ? "s" : ""}
            </span>
            <span className={styles.routineMeta}>
              {expandedId === routine.id ? "\u25B2" : "\u25BC"}
            </span>
          </div>

          {expandedId === routine.id && (
            <RoutineDetail
              routine={routine}
              onDelete={() => deleteRoutine(routine.id)}
              applyingId={applyingId}
              applyDate={applyDate}
              onSetApplyingId={setApplyingId}
              onSetApplyDate={setApplyDate}
              onApply={() => applyToWorkout(routine.id)}
            />
          )}
        </Card>
      ))}
    </div>
  );
}

function RoutineDetail({
  routine,
  onDelete,
  applyingId,
  applyDate,
  onSetApplyingId,
  onSetApplyDate,
  onApply,
}: {
  routine: RoutineWithBlocks;
  onDelete: () => void;
  applyingId: string | null;
  applyDate: string;
  onSetApplyingId: (id: string | null) => void;
  onSetApplyDate: (date: string) => void;
  onApply: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockType, setNewBlockType] = useState("strength");
  const [newBlockName, setNewBlockName] = useState("");

  // Exercise search using shared hook
  const [addingExToBlock, setAddingExToBlock] = useState<string | null>(null);
  const [exQuery, setExQuery] = useState("");
  const { results: exResults, clearResults } = useExerciseSearch(exQuery);

  async function addBlock() {
    const name =
      newBlockName ||
      newBlockType.charAt(0).toUpperCase() + newBlockType.slice(1);
    try {
      const res = await fetch(`/api/tempapp/routines/${routine.id}`, {
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
      if (!res.ok) throw new Error("Failed to add block");
      setShowAddBlock(false);
      setNewBlockName("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add block");
    }
  }

  async function addExToBlock(blockId: string, exerciseId: string) {
    try {
      const res = await fetch(`/api/tempapp/routines/${routine.id}`, {
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
      if (!res.ok) throw new Error("Failed to add exercise");
      setAddingExToBlock(null);
      setExQuery("");
      clearResults();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add exercise");
    }
  }

  const isApplying = applyingId === routine.id;

  return (
    <div className={styles.detailBody}>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Action buttons */}
      <div className={styles.actionButtons}>
        <Button
          variant="success"
          size="sm"
          onClick={() => onSetApplyingId(isApplying ? null : routine.id)}
        >
          Apply to Workout
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowAddBlock(true)}
        >
          + Add Block
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          Delete Routine
        </Button>
      </div>

      {/* Apply form */}
      {isApplying && (
        <div className={styles.applyForm}>
          <label className={styles.applyLabel}>Apply to date:</label>
          <Input
            compact
            type="date"
            value={applyDate}
            onChange={(e) => onSetApplyDate(e.target.value)}
          />
          <Button
            variant="success"
            size="sm"
            onClick={onApply}
            disabled={!applyDate}
          >
            Apply
          </Button>
          <Button size="sm" onClick={() => onSetApplyingId(null)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Add block form */}
      {showAddBlock && (
        <div className={styles.addBlockForm}>
          <Select
            compact
            value={newBlockType}
            onChange={(e) => setNewBlockType(e.target.value)}
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </Select>
          <Input
            compact
            value={newBlockName}
            onChange={(e) => setNewBlockName(e.target.value)}
            placeholder="Block name (optional)"
            className={styles.blockNameInput}
          />
          <Button variant="primary" size="sm" onClick={addBlock}>
            Add
          </Button>
          <Button size="sm" onClick={() => setShowAddBlock(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Blocks */}
      {(!routine.blocks || routine.blocks.length === 0) && (
        <p className={styles.emptyBlocks}>
          No blocks in this routine yet.
        </p>
      )}

      {routine.blocks?.map((block) => (
        <div key={block.id} className={styles.blockCard}>
          <div className={styles.blockHeader}>
            <span className={styles.blockName}>{block.name}</span>
            <Badge variant="blockType">{block.block_type}</Badge>
          </div>

          {block.exercises?.map((ex) => (
            <div key={ex.id} className={styles.exerciseRow}>
              <span className={styles.exerciseName}>
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
            <div className={styles.searchArea}>
              <div className={styles.searchRow}>
                <Input
                  compact
                  value={exQuery}
                  onChange={(e) => setExQuery(e.target.value)}
                  placeholder="Search exercises..."
                  className={styles.searchInput}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => {
                    setAddingExToBlock(null);
                    setExQuery("");
                    clearResults();
                  }}
                >
                  Cancel
                </Button>
              </div>
              {exResults.length > 0 && (
                <div className={styles.searchResults}>
                  {exResults.map((ex) => (
                    <div
                      key={ex.id}
                      onClick={() => addExToBlock(block.id, ex.id)}
                      className={styles.searchResultItem}
                    >
                      {ex.name}{" "}
                      {ex.equipment && (
                        <span className={styles.searchResultEquipment}>({ex.equipment})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.addExerciseWrap}>
              <button
                onClick={() => setAddingExToBlock(block.id)}
                className={styles.addExerciseBtn}
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
