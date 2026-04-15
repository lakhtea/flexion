"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  WorkoutPlanWithBlocks,
  WorkoutBlockWithExercises,
  WorkoutExercise,
  Exercise,
} from "@/lib/tempapp/types";
import { BLOCK_TYPES } from "@/lib/tempapp/types";
import { computeReorder, submitReorder } from "@/lib/tempapp/reorder";
import { useExerciseSearch } from "../../hooks/use-exercise-search";
import { COMMENT_MAX_LENGTH } from "@/lib/tempapp/constants";
import {
  Button,
  Card,
  CardHeader,
  Badge,
  FormField,
  Input,
  Select,
  FormRow,
  EmptyState,
  Alert,
} from "../../components";
import styles from "./planEditor.module.css";

interface PlanEditorClientProps {
  initialPlan: WorkoutPlanWithBlocks | null;
  date: string;
}

export default function PlanEditorClient({ initialPlan, date }: PlanEditorClientProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<WorkoutPlanWithBlocks | null>(initialPlan);
  const [error, setError] = useState<string | null>(null);

  // Add block form
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockType, setNewBlockType] = useState<string>("strength");
  const [newBlockName, setNewBlockName] = useState("");

  // Routine picker
  const [showRoutinePicker, setShowRoutinePicker] = useState(false);
  const [routines, setRoutines] = useState<Array<{ id: string; name: string; description: string }>>([]);

  async function ensurePlan(): Promise<WorkoutPlanWithBlocks | null> {
    if (plan) return plan;
    // Create a new plan for this date
    try {
      const createRes = await fetch("/api/tempapp/workout-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specific_date: date }),
      });
      if (!createRes.ok) throw new Error("Failed to create plan");
      const created = await createRes.json();
      const newPlan = { ...created, blocks: [] } as WorkoutPlanWithBlocks;
      setPlan(newPlan);
      return newPlan;
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
      return null;
    }
  }

  async function addBlock() {
    const currentPlan = await ensurePlan();
    if (!currentPlan) return;
    const name = newBlockName || newBlockType.charAt(0).toUpperCase() + newBlockType.slice(1);
    try {
      const res = await fetch(`/api/tempapp/workout-plans/${currentPlan.id}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          block_type: newBlockType,
          sort_order: currentPlan.blocks.length,
        }),
      });
      if (!res.ok) throw new Error("Failed to add block");
      setShowAddBlock(false);
      setNewBlockName("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  }

  async function deleteBlock(blockId: string) {
    try {
      const res = await fetch(`/api/tempapp/workout-blocks/${blockId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete block");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  }

  async function moveBlock(blockId: string, direction: "up" | "down") {
    if (!plan) return;
    const ordered = computeReorder(plan.blocks, blockId, direction);
    if (!ordered) return;

    const ok = await submitReorder("/api/tempapp/workout-blocks/reorder", "blocks", ordered);
    if (ok) {
      router.refresh();
    } else {
      setError("Failed to reorder blocks");
    }
  }

  async function loadRoutines() {
    try {
      const res = await fetch("/api/tempapp/routines");
      if (!res.ok) return;
      const data = await res.json();
      setRoutines(data);
      setShowRoutinePicker(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  }

  async function applyRoutine(routineId: string) {
    const currentPlan = await ensurePlan();
    if (!currentPlan) return;
    try {
      const res = await fetch(`/api/tempapp/routines/${routineId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workout_plan_id: currentPlan.id }),
      });
      if (!res.ok) throw new Error("Failed to apply routine");
      setShowRoutinePicker(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  }

  // Determine display title
  const isUUID = date.includes("-") && date.length > 10;
  const title = isUUID ? "Recurring Workout" : `Workout for ${date}`;

  return (
    <div className={styles.page}>
      {error && <Alert variant="error">Error: {error}</Alert>}

      <div className={styles.headerWrap}>
        <div>
          <Link href="/tempapp/plan" className={styles.backLink}>
            &larr; Back to Planner
          </Link>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <FormRow>
          <Button size="sm" onClick={loadRoutines}>
            Add from Routine
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAddBlock(true)}>
            + Add Block
          </Button>
        </FormRow>
      </div>

      {/* Routine picker */}
      {showRoutinePicker && (
        <Card>
          <div className={styles.routinePickerHeader}>
            <span className={styles.routinePickerTitle}>Select a Routine</span>
            <Button size="sm" onClick={() => setShowRoutinePicker(false)}>
              Cancel
            </Button>
          </div>
          {routines.length === 0 && (
            <p className={`${styles.noRoutines} ${styles.noRoutinesPadded}`}>No routines available.</p>
          )}
          {routines.map((r) => (
            <div key={r.id} className={styles.routineItem}>
              <div>
                <span className={styles.routineName}>{r.name}</span>
                {r.description && (
                  <span className={styles.routineDesc}>
                    {" "}- {r.description}
                  </span>
                )}
              </div>
              <Button variant="primary" size="sm" onClick={() => applyRoutine(r.id)}>
                Apply
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* Add block form */}
      {showAddBlock && (
        <div className={styles.addBlockForm}>
          <FormField label="Type" compact>
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
          </FormField>
          <div className={styles.addBlockFieldGrow}>
            <FormField label="Name (optional)" compact>
              <Input
                compact
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                placeholder={newBlockType.charAt(0).toUpperCase() + newBlockType.slice(1)}
              />
            </FormField>
          </div>
          <Button variant="primary" onClick={addBlock}>Add</Button>
          <Button onClick={() => setShowAddBlock(false)}>Cancel</Button>
        </div>
      )}

      {/* Blocks */}
      {plan && plan.blocks.length === 0 && (
        <EmptyState>
          No blocks yet. Add a block to start building this workout.
        </EmptyState>
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
            onRefresh={() => router.refresh()}
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
  onRefresh,
}: {
  block: WorkoutBlockWithExercises;
  planId: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [blockName, setBlockName] = useState(block.name);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    try {
      await fetch(`/api/tempapp/workout-blocks/${block.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: blockName }),
      });
      setEditingName(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  }

  async function moveExercise(exerciseId: string, direction: "up" | "down") {
    const ordered = computeReorder(block.exercises, exerciseId, direction);
    if (!ordered) return;

    const ok = await submitReorder("/api/tempapp/workout-exercises/reorder", "exercises", ordered);
    if (ok) {
      onRefresh();
    } else {
      setError("Failed to reorder exercises");
    }
  }

  async function deleteExercise(exerciseId: string) {
    try {
      await fetch(`/api/tempapp/workout-exercises/${exerciseId}`, {
        method: "DELETE",
      });
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  }

  return (
    <Card>
      {error && <Alert variant="error">{error}</Alert>}
      {/* Block header */}
      <CardHeader subtle>
        <div className={styles.blockHeaderRow}>
          <div className={styles.moveButtons}>
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className={isFirst ? styles.moveBtnDisabled : styles.moveBtn}
            >
              &#9650;
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className={isLast ? styles.moveBtnDisabled : styles.moveBtn}
            >
              &#9660;
            </button>
          </div>

          {editingName ? (
            <div className={styles.blockNameEditing}>
              <input
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                className={styles.blockNameInput}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
              />
              <Button variant="primary" size="sm" onClick={saveName}>Save</Button>
            </div>
          ) : (
            <span
              className={styles.blockNameDisplay}
              onClick={() => setEditingName(true)}
            >
              {block.name}
              <span className={styles.blockTypeLabel}>
                {" "}({block.block_type})
              </span>
            </span>
          )}

          <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>
        </div>
      </CardHeader>

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
          onRefresh={onRefresh}
        />
      ))}

      {/* Add exercise */}
      <div className={styles.addExerciseArea}>
        {showAddExercise ? (
          <ExerciseSearchPanel
            blockId={block.id}
            sortOrder={block.exercises.length}
            onDone={() => {
              setShowAddExercise(false);
              onRefresh();
            }}
            onCancel={() => setShowAddExercise(false)}
          />
        ) : (
          <Button
            fullWidth
            onClick={() => setShowAddExercise(true)}
            className={styles.addExerciseBtn}
          >
            + Add Exercise
          </Button>
        )}
      </div>
    </Card>
  );
}

function ExerciseSearchPanel({
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
  const { results, clearResults } = useExerciseSearch(query);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEquipment, setNewEquipment] = useState("");
  const [newContext, setNewContext] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      clearResults();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  }

  return (
    <div className={styles.searchContainer}>
      {error && <Alert variant="error">{error}</Alert>}
      <div className={styles.searchRow}>
        <div className={styles.searchInputWrap}>
          <Input
            compact
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises..."
            autoFocus
          />
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>New</Button>
        <Button size="sm" onClick={onCancel}>Cancel</Button>
      </div>

      {results.length > 0 && (
        <div className={styles.searchResults}>
          {results.map((ex) => (
            <div
              key={ex.id}
              onClick={() => addExercise(ex.id)}
              className={styles.searchResultItem}
            >
              <span className={styles.searchResultName}>{ex.name}</span>
              {ex.equipment && (
                <Badge variant="equipment">{ex.equipment}</Badge>
              )}
              {ex.context_label && (
                <span className={styles.searchResultContext}>
                  ({ex.context_label})
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className={styles.createForm}>
          <Input
            compact
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Exercise name"
          />
          <div className={styles.createRow}>
            <Input
              compact
              className={styles.createInputFlex}
              value={newEquipment}
              onChange={(e) => setNewEquipment(e.target.value)}
              placeholder="Equipment (e.g. barbell)"
            />
            <Input
              compact
              className={styles.createInputFlex}
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              placeholder="Context (e.g. tempo)"
            />
          </div>
          <Button variant="primary" onClick={createAndAdd}>
            Create &amp; Add
          </Button>
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
  onRefresh,
}: {
  ex: WorkoutExercise & { exercise: Exercise };
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
  const [timeSeconds, setTimeSeconds] = useState(ex.time_seconds?.toString() ?? "");
  const [rpe, setRpe] = useState(ex.rpe?.toString() ?? "");
  const [restSeconds, setRestSeconds] = useState(ex.rest_seconds?.toString() ?? "");
  const [isSupersetWithNext, setIsSupersetWithNext] = useState(!!ex.is_superset_with_next);
  const [reminder, setReminder] = useState(ex.reminder ?? "");
  const [comment, setComment] = useState(ex.comment ?? "");
  const [error, setError] = useState<string | null>(null);

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
          comment: comment.slice(0, COMMENT_MAX_LENGTH) || null,
        }),
      });
      setEditing(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
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
      {error && <Alert variant="error">{error}</Alert>}
      <div className={styles.exerciseTop}>
        <div className={styles.exerciseMoveButtons}>
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className={isFirst ? styles.exerciseMoveBtnDisabled : styles.exerciseMoveBtn}
          >
            &#9650;
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className={isLast ? styles.exerciseMoveBtnDisabled : styles.exerciseMoveBtn}
          >
            &#9660;
          </button>
        </div>
        <span className={styles.exerciseName}>
          {ex.exercise.name}
          {ex.exercise.equipment && (
            <>
              {" "}<Badge variant="equipment">{ex.exercise.equipment}</Badge>
            </>
          )}
        </span>
        {!editing && (
          <span className={styles.exerciseDetail}>
            {detailParts.join(" ")}
          </span>
        )}
        <Button size="sm" onClick={() => setEditing(!editing)}>
          {editing ? "Close" : "Edit"}
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>X</Button>
      </div>

      {editing && (
        <div className={styles.editForm}>
          <div className={styles.fieldRow}>
            <FormField label="Sets" compact>
              <Input compact value={sets} onChange={(e) => setSets(e.target.value)} type="number" />
            </FormField>
            <FormField label="Reps" compact>
              <Input compact value={reps} onChange={(e) => setReps(e.target.value)} placeholder="e.g. 8-12" />
            </FormField>
            <FormField label="Weight" compact>
              <Input compact value={weight} onChange={(e) => setWeight(e.target.value)} type="number" />
            </FormField>
            <FormField label="Unit" compact>
              <Select compact value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}>
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
                <option value="bw">bw</option>
              </Select>
            </FormField>
            <FormField label="Time (s)" compact>
              <Input compact value={timeSeconds} onChange={(e) => setTimeSeconds(e.target.value)} type="number" />
            </FormField>
            <FormField label="RPE" compact>
              <Input compact value={rpe} onChange={(e) => setRpe(e.target.value)} type="number" min="1" max="10" />
            </FormField>
            <FormField label="Rest (s)" compact>
              <Input compact value={restSeconds} onChange={(e) => setRestSeconds(e.target.value)} type="number" />
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
          <div className={styles.reminderRow}>
            <FormField label="Reminder" compact className={styles.reminderField}>
              <Input
                compact
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
                placeholder="e.g. squeeze at top"
              />
            </FormField>
            <FormField label={`Comment (max ${COMMENT_MAX_LENGTH})`} compact className={styles.reminderField}>
              <Input
                compact
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
                maxLength={COMMENT_MAX_LENGTH}
              />
            </FormField>
          </div>
          <Button variant="primary" onClick={save} className={styles.saveBtnStart}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
