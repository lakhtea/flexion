"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  RoutineWithBlocks,
  RoutineBlockWithExercises,
  RoutineExercise,
  Exercise,
} from "@/lib/tempapp/types";
import { BLOCK_TYPES } from "@/lib/tempapp/types";
import { computeReorder, submitReorder } from "@/lib/tempapp/reorder";
import { useExerciseSearch } from "../hooks/use-exercise-search";
import {
  Button,
  Card,
  CardHeader,
  Badge,
  Input,
  Select,
  FormField,
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
      const planRes = await fetch(`/api/tempapp/workout-plans/for-date/${applyDate}`);
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

  async function deleteBlock(blockId: string) {
    try {
      const res = await fetch(`/api/tempapp/routine-blocks/${blockId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete block");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete block");
    }
  }

  async function moveBlock(blockId: string, direction: "up" | "down") {
    if (!routine.blocks) return;
    const ordered = computeReorder(routine.blocks, blockId, direction);
    if (!ordered) return;

    const ok = await submitReorder(
      "/api/tempapp/routine-blocks/reorder",
      "blocks",
      ordered
    );
    if (ok) {
      router.refresh();
    } else {
      setError("Failed to reorder blocks");
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

  async function deleteExercise(exerciseId: string) {
    try {
      const res = await fetch(`/api/tempapp/routine-exercises/${exerciseId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete exercise");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete exercise");
    }
  }

  async function moveExercise(
    block: RoutineBlockWithExercises,
    exerciseId: string,
    direction: "up" | "down"
  ) {
    if (!block.exercises) return;
    const ordered = computeReorder(block.exercises, exerciseId, direction);
    if (!ordered) return;

    const ok = await submitReorder(
      "/api/tempapp/routine-exercises/reorder",
      "exercises",
      ordered
    );
    if (ok) {
      router.refresh();
    } else {
      setError("Failed to reorder exercises");
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

      {routine.blocks?.map((block, idx) => (
        <div key={block.id} className={styles.blockCard}>
          <div className={styles.blockHeader}>
            <div className={styles.moveButtons}>
              <button
                onClick={() => moveBlock(block.id, "up")}
                disabled={idx === 0}
                className={idx === 0 ? styles.moveBtnDisabled : styles.moveBtn}
              >
                &#9650;
              </button>
              <button
                onClick={() => moveBlock(block.id, "down")}
                disabled={idx === (routine.blocks?.length ?? 1) - 1}
                className={
                  idx === (routine.blocks?.length ?? 1) - 1
                    ? styles.moveBtnDisabled
                    : styles.moveBtn
                }
              >
                &#9660;
              </button>
            </div>
            <span className={styles.blockName}>{block.name}</span>
            <Badge variant="blockType">{block.block_type}</Badge>
            <Button
              variant="danger"
              size="sm"
              onClick={() => deleteBlock(block.id)}
            >
              Delete
            </Button>
          </div>

          {block.exercises?.map((ex, exIdx) => (
            <RoutineExerciseEditor
              key={ex.id}
              ex={ex}
              block={block}
              isFirst={exIdx === 0}
              isLast={exIdx === (block.exercises?.length ?? 1) - 1}
              onMoveUp={() => moveExercise(block, ex.id, "up")}
              onMoveDown={() => moveExercise(block, ex.id, "down")}
              onDelete={() => deleteExercise(ex.id)}
              onRefresh={() => router.refresh()}
            />
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
                        <span className={styles.searchResultEquipment}>
                          ({ex.equipment})
                        </span>
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

function RoutineExerciseEditor({
  ex,
  block,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onRefresh,
}: {
  ex: RoutineExercise & { exercise?: Exercise };
  block: RoutineBlockWithExercises;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [sets, setSets] = useState(ex.sets?.toString() ?? "");
  const [reps, setReps] = useState(ex.reps ?? "");
  const [weight, setWeight] = useState(ex.weight?.toString() ?? "");
  const [weightUnit, setWeightUnit] = useState(ex.weight_unit || "lbs");
  const [timeSeconds, setTimeSeconds] = useState(
    ex.time_seconds?.toString() ?? ""
  );
  const [rpe, setRpe] = useState(ex.rpe?.toString() ?? "");
  const [restSeconds, setRestSeconds] = useState(
    ex.rest_seconds?.toString() ?? ""
  );
  const [isSupersetWithNext, setIsSupersetWithNext] = useState(
    !!ex.is_superset_with_next
  );
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      const res = await fetch(`/api/tempapp/routine-exercises/${ex.id}`, {
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
        }),
      });
      if (!res.ok) throw new Error("Failed to save exercise");
      setEditing(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save exercise");
    }
  }

  const detailParts: string[] = [];
  if (ex.sets !== null) detailParts.push(`${ex.sets}x`);
  if (ex.reps !== null) detailParts.push(ex.reps);
  if (ex.weight !== null) detailParts.push(`@ ${ex.weight} ${ex.weight_unit}`);
  if (ex.time_seconds !== null) detailParts.push(`${ex.time_seconds}s`);
  if (ex.rpe !== null) detailParts.push(`RPE ${ex.rpe}`);
  if (ex.rest_seconds !== null) detailParts.push(`Rest ${ex.rest_seconds}s`);

  return (
    <div className={styles.exerciseRow}>
      {error && <p style={{ color: "red", fontSize: 12 }}>{error}</p>}
      <div className={styles.exerciseTop}>
        <div className={styles.exerciseMoveButtons}>
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className={
              isFirst ? styles.exerciseMoveBtnDisabled : styles.exerciseMoveBtn
            }
          >
            &#9650;
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className={
              isLast ? styles.exerciseMoveBtnDisabled : styles.exerciseMoveBtn
            }
          >
            &#9660;
          </button>
        </div>
        <span className={styles.exerciseName}>
          {ex.exercise?.name ?? "Unknown"}
        </span>
        {!editing && detailParts.length > 0 && (
          <span className={styles.exerciseDetail}>
            {detailParts.join(" ")}
          </span>
        )}
        <Button size="sm" onClick={() => setEditing(!editing)}>
          {editing ? "Close" : "Edit"}
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          X
        </Button>
      </div>

      {editing && (
        <div className={styles.editForm}>
          <div className={styles.fieldRow}>
            <FormField label="Sets" compact>
              <Input
                compact
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                type="number"
              />
            </FormField>
            <FormField label="Reps" compact>
              <Input
                compact
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="e.g. 8-12"
              />
            </FormField>
            <FormField label="Weight" compact>
              <Input
                compact
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                type="number"
              />
            </FormField>
            <FormField label="Unit" compact>
              <Select
                compact
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value)}
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
                <option value="bw">bw</option>
              </Select>
            </FormField>
            <FormField label="Time (s)" compact>
              <Input
                compact
                value={timeSeconds}
                onChange={(e) => setTimeSeconds(e.target.value)}
                type="number"
              />
            </FormField>
            <FormField label="RPE" compact>
              <Input
                compact
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                type="number"
                min="1"
                max="10"
              />
            </FormField>
            <FormField label="Rest (s)" compact>
              <Input
                compact
                value={restSeconds}
                onChange={(e) => setRestSeconds(e.target.value)}
                type="number"
              />
            </FormField>
          </div>
          <div className={styles.supersetCheck}>
            <label className={styles.supersetLabel}>
              <input
                type="checkbox"
                checked={isSupersetWithNext}
                onChange={(e) => setIsSupersetWithNext(e.target.checked)}
              />{" "}
              Superset with next
            </label>
          </div>
          <Button
            variant="primary"
            onClick={save}
            className={styles.saveBtnStart}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
