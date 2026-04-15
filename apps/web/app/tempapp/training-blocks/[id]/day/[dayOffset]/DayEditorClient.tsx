"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  TrainingBlockWithDays,
  TrainingBlockDayWithBlocks,
  TrainingBlockDayBlockWithExercises,
} from "@/lib/tempapp/types";
import { BLOCK_TYPES } from "@/lib/tempapp/types";
import { useExerciseSearch } from "../../../../hooks/use-exercise-search";
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
} from "../../../../components";
import styles from "./page.module.css";

interface DayEditorClientProps {
  block: TrainingBlockWithDays;
  day: TrainingBlockDayWithBlocks;
}

export default function DayEditorClient({ block, day }: DayEditorClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Day label editing
  const [editingLabel, setEditingLabel] = useState(false);
  const [label, setLabel] = useState(day.label);

  // Rest day toggle
  const [isRestDay, setIsRestDay] = useState(day.is_rest_day === 1);

  // Add block form
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockType, setNewBlockType] = useState("strength");
  const [newBlockName, setNewBlockName] = useState("");

  // Exercise search
  const [addingExToBlock, setAddingExToBlock] = useState<string | null>(null);
  const [exQuery, setExQuery] = useState("");
  const { results: exResults, clearResults } = useExerciseSearch(exQuery);

  const apiBase = `/api/tempapp/training-blocks/${block.id}/days/${day.id}`;

  const mutateDay = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const res = await fetch(apiBase, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Request failed");
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
      }
    },
    [apiBase, router]
  );

  async function saveLabel() {
    await mutateDay({ label });
    setEditingLabel(false);
  }

  async function toggleRestDay() {
    const newVal = !isRestDay;
    setIsRestDay(newVal);
    await mutateDay({ is_rest_day: newVal ? 1 : 0 });
  }

  async function addBlock() {
    const name =
      newBlockName.trim() ||
      newBlockType.charAt(0).toUpperCase() + newBlockType.slice(1);
    await mutateDay({
      add_block: {
        name,
        block_type: newBlockType,
        sort_order: day.blocks.length,
      },
    });
    setShowAddBlock(false);
    setNewBlockName("");
  }

  async function deleteBlock(blockId: string) {
    if (!confirm("Delete this block and all its exercises?")) return;
    await mutateDay({ delete_block: blockId });
  }

  async function addExToBlock(dayBlockId: string, exerciseId: string) {
    const dayBlock = day.blocks.find((b) => b.id === dayBlockId);
    await mutateDay({
      add_exercise: {
        training_block_day_block_id: dayBlockId,
        exercise_id: exerciseId,
        sort_order: dayBlock?.exercises.length ?? 0,
      },
    });
    setAddingExToBlock(null);
    setExQuery("");
    clearResults();
  }

  async function updateExercise(
    exerciseId: string,
    field: string,
    value: string | number | null
  ) {
    await mutateDay({
      update_exercise: { id: exerciseId, [field]: value },
    });
  }

  async function deleteExercise(exerciseId: string) {
    await mutateDay({ delete_exercise: exerciseId });
  }

  return (
    <div className={styles.page}>
      <button
        className={styles.backLink}
        onClick={() => router.push("/tempapp/training-blocks")}
      >
        &larr; Back to {block.name}
      </button>

      <PageHeader title={day.label}>
        <Badge variant="blockType">
          Day {day.day_offset + 1} of {block.cycle_days}
        </Badge>
      </PageHeader>

      {error && (
        <Card>
          <div className={styles.actionButtons}>
            <p style={{ color: "var(--danger)", flex: 1 }}>{error}</p>
            <Button size="sm" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Day label + rest toggle */}
      <Card>
        <div className={styles.dayHeader}>
          <CardHeader>Day Settings</CardHeader>
          <div className={styles.labelRow}>
            {editingLabel ? (
              <>
                <Input
                  compact
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className={styles.labelInput}
                  autoFocus
                />
                <Button size="sm" variant="primary" onClick={saveLabel}>
                  Save
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setLabel(day.label);
                    setEditingLabel(false);
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span>{day.label}</span>
                <Button size="sm" onClick={() => setEditingLabel(true)}>
                  Edit Label
                </Button>
              </>
            )}
          </div>
          <div className={styles.restToggle}>
            <label>
              <input
                type="checkbox"
                checked={isRestDay}
                onChange={toggleRestDay}
              />
              Rest day
            </label>
          </div>
        </div>
      </Card>

      {/* Rest day message */}
      {isRestDay && (
        <EmptyState>
          This is a rest day. Toggle off &ldquo;Rest day&rdquo; above to add
          workout blocks.
        </EmptyState>
      )}

      {/* Workout blocks */}
      {!isRestDay && (
        <>
          <div className={styles.actionButtons}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddBlock(true)}
            >
              + Add Block
            </Button>
          </div>

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

          {day.blocks.length === 0 && !showAddBlock && (
            <EmptyState>
              No workout blocks yet. Add one to start building this day&apos;s
              workout.
            </EmptyState>
          )}

          {day.blocks.map((wb) => (
            <WorkoutBlockCard
              key={wb.id}
              workoutBlock={wb}
              addingExToBlock={addingExToBlock}
              exQuery={exQuery}
              exResults={exResults}
              onSetAddingExToBlock={setAddingExToBlock}
              onSetExQuery={setExQuery}
              onClearResults={clearResults}
              onAddExToBlock={addExToBlock}
              onUpdateExercise={updateExercise}
              onDeleteExercise={deleteExercise}
              onDeleteBlock={deleteBlock}
            />
          ))}
        </>
      )}
    </div>
  );
}

function WorkoutBlockCard({
  workoutBlock,
  addingExToBlock,
  exQuery,
  exResults,
  onSetAddingExToBlock,
  onSetExQuery,
  onClearResults,
  onAddExToBlock,
  onUpdateExercise,
  onDeleteExercise,
  onDeleteBlock,
}: {
  workoutBlock: TrainingBlockDayBlockWithExercises;
  addingExToBlock: string | null;
  exQuery: string;
  exResults: Array<{ id: string; name: string; equipment: string }>;
  onSetAddingExToBlock: (id: string | null) => void;
  onSetExQuery: (q: string) => void;
  onClearResults: () => void;
  onAddExToBlock: (blockId: string, exerciseId: string) => void;
  onUpdateExercise: (
    exerciseId: string,
    field: string,
    value: string | number | null
  ) => void;
  onDeleteExercise: (exerciseId: string) => void;
  onDeleteBlock: (blockId: string) => void;
}) {
  return (
    <div className={styles.workoutBlock}>
      <div className={styles.workoutBlockHeader}>
        <span className={styles.workoutBlockName}>{workoutBlock.name}</span>
        <Badge variant="blockType">{workoutBlock.block_type}</Badge>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDeleteBlock(workoutBlock.id)}
        >
          Delete
        </Button>
      </div>

      {workoutBlock.exercises.map((ex) => (
        <ExerciseRow
          key={ex.id}
          exercise={ex}
          onUpdate={onUpdateExercise}
          onDelete={onDeleteExercise}
        />
      ))}

      {/* Add exercise */}
      {addingExToBlock === workoutBlock.id ? (
        <div className={styles.searchArea}>
          <div className={styles.searchRow}>
            <Input
              compact
              value={exQuery}
              onChange={(e) => onSetExQuery(e.target.value)}
              placeholder="Search exercises..."
              className={styles.searchInput}
              autoFocus
            />
            <Button
              size="sm"
              onClick={() => {
                onSetAddingExToBlock(null);
                onSetExQuery("");
                onClearResults();
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
                  onClick={() => onAddExToBlock(workoutBlock.id, ex.id)}
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
            onClick={() => onSetAddingExToBlock(workoutBlock.id)}
            className={styles.addExerciseBtn}
          >
            + Add Exercise
          </button>
        </div>
      )}
    </div>
  );
}

function ExerciseRow({
  exercise,
  onUpdate,
  onDelete,
}: {
  exercise: TrainingBlockDayBlockWithExercises["exercises"][number];
  onUpdate: (
    exerciseId: string,
    field: string,
    value: string | number | null
  ) => void;
  onDelete: (exerciseId: string) => void;
}) {
  function handleBlur(field: string, value: string, type: "number" | "string") {
    if (type === "number") {
      const num = value === "" ? null : parseFloat(value);
      onUpdate(exercise.id, field, num);
    } else {
      onUpdate(exercise.id, field, value || null);
    }
  }

  return (
    <div className={styles.exerciseCard}>
      <div className={styles.exerciseHeader}>
        <span className={styles.exerciseName}>
          {exercise.exercise?.name ?? "Unknown exercise"}
        </span>
        <Button variant="danger" size="sm" onClick={() => onDelete(exercise.id)}>
          Remove
        </Button>
      </div>

      <div className={styles.exerciseFields}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Sets</span>
          <Input
            compact
            type="number"
            defaultValue={exercise.sets ?? ""}
            onBlur={(e) => handleBlur("sets", e.target.value, "number")}
            className={styles.fieldInputNarrow}
            min={0}
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Reps</span>
          <Input
            compact
            defaultValue={exercise.reps ?? ""}
            onBlur={(e) => handleBlur("reps", e.target.value, "string")}
            className={styles.fieldInputNarrow}
            placeholder="e.g. 8-12"
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Weight</span>
          <Input
            compact
            type="number"
            defaultValue={exercise.weight ?? ""}
            onBlur={(e) => handleBlur("weight", e.target.value, "number")}
            className={styles.fieldInput}
            min={0}
            step={0.5}
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Unit</span>
          <Select
            compact
            defaultValue={exercise.weight_unit}
            onChange={(e) =>
              onUpdate(exercise.id, "weight_unit", e.target.value)
            }
            className={styles.fieldInputNarrow}
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
            <option value="bw">bw</option>
          </Select>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Time (s)</span>
          <Input
            compact
            type="number"
            defaultValue={exercise.time_seconds ?? ""}
            onBlur={(e) =>
              handleBlur("time_seconds", e.target.value, "number")
            }
            className={styles.fieldInput}
            min={0}
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>RPE</span>
          <Input
            compact
            type="number"
            defaultValue={exercise.rpe ?? ""}
            onBlur={(e) => handleBlur("rpe", e.target.value, "number")}
            className={styles.fieldInputNarrow}
            min={1}
            max={10}
            step={0.5}
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Rest (s)</span>
          <Input
            compact
            type="number"
            defaultValue={exercise.rest_seconds ?? ""}
            onBlur={(e) =>
              handleBlur("rest_seconds", e.target.value, "number")
            }
            className={styles.fieldInput}
            min={0}
          />
        </div>
      </div>

      <div className={styles.supersetToggle}>
        <label>
          <input
            type="checkbox"
            defaultChecked={exercise.is_superset_with_next === 1}
            onChange={(e) =>
              onUpdate(
                exercise.id,
                "is_superset_with_next",
                e.target.checked ? 1 : 0
              )
            }
          />
          Superset with next
        </label>
      </div>
    </div>
  );
}
