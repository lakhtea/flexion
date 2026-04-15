"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Exercise, ExerciseTrackerContribution } from "@/lib/tempapp/types";
import { BLOCK_TYPES } from "@/lib/tempapp/types";
import {
  Button,
  Card,
  CardHeader,
  Badge,
  FormField,
  Input,
  Select,
  FormRow,
  PageHeader,
  Alert,
} from "../components";
import styles from "./exercises.module.css";

interface ExercisesClientProps {
  initialExercises: Exercise[];
}

export default function ExercisesClient({ initialExercises }: ExercisesClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New exercise form
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEquipment, setNewEquipment] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newDefaultBlock, setNewDefaultBlock] = useState("strength");

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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  }

  // Filter
  const filtered = initialExercises
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

  return (
    <div className={styles.page}>
      <PageHeader title="Exercise Library">
        <Button variant="primary" onClick={() => setShowNew(!showNew)}>
          + New Exercise
        </Button>
      </PageHeader>

      {error && <Alert variant="error">{error}</Alert>}

      {showNew && (
        <div className={styles.newForm}>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Exercise name"
            autoFocus
          />
          <div className={styles.formRow}>
            <Input
              className={styles.formRowInputFlex}
              value={newEquipment}
              onChange={(e) => setNewEquipment(e.target.value)}
              placeholder="Equipment (e.g. barbell)"
            />
            <Input
              className={styles.formRowInputFlex}
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              placeholder="Context label (e.g. tempo)"
            />
            <Select
              value={newDefaultBlock}
              onChange={(e) => setNewDefaultBlock(e.target.value)}
            >
              {BLOCK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <FormRow>
            <Button variant="primary" onClick={createExercise}>Create</Button>
            <Button onClick={() => setShowNew(false)}>Cancel</Button>
          </FormRow>
        </div>
      )}

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises..."
      />

      <Card>
        {filtered.length === 0 && (
          <p className={styles.noExercises}>
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
            onRefresh={() => router.refresh()}
          />
        ))}
      </Card>

      <p className={styles.count}>
        {filtered.length} exercise{filtered.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function ExerciseRow({
  exercise,
  isExpanded,
  onToggle,
  onRefresh,
}: {
  exercise: Exercise;
  isExpanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [equipment, setEquipment] = useState(exercise.equipment);
  const [contextLabel, setContextLabel] = useState(exercise.context_label);
  const [defaultBlock, setDefaultBlock] = useState(exercise.default_block_type);
  const [error, setError] = useState<string | null>(null);

  // Contributions
  const [contributions, setContributions] = useState<ExerciseTrackerContribution[]>([]);
  const [loadingContribs, setLoadingContribs] = useState(false);
  const [newTrackerKey, setNewTrackerKey] = useState("");
  const [newValue, setNewValue] = useState("");

  // This useEffect is legitimate: it synchronizes contributions data with the
  // expanded state. The "event" is the user expanding a row; the effect fetches
  // the detail data that only makes sense to load on demand.
  useEffect(() => {
    if (isExpanded) {
      loadContributions();
    }
  }, [isExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadContributions() {
    setLoadingContribs(true);
    try {
      const res = await fetch(`/api/tempapp/exercises/${exercise.id}/contributions`);
      if (!res.ok) throw new Error("Failed to load contributions");
      const data = await res.json();
      setContributions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
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
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  }

  async function deleteExercise() {
    if (!confirm("Delete this exercise?")) return;
    try {
      await fetch(`/api/tempapp/exercises/${exercise.id}`, { method: "DELETE" });
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  }

  return (
    <div className={styles.exerciseItem}>
      <div
        onClick={onToggle}
        className={styles.exerciseRowTop}
      >
        <span className={styles.exerciseName}>{exercise.name}</span>
        {exercise.equipment && (
          <Badge variant="equipment">{exercise.equipment}</Badge>
        )}
        {exercise.context_label && (
          <Badge variant="context">{exercise.context_label}</Badge>
        )}
        <span className={styles.chevron}>
          {isExpanded ? "\u25B2" : "\u25BC"}
        </span>
      </div>

      {isExpanded && (
        <div className={styles.expandedContent}>
          {error && <Alert variant="error">{error}</Alert>}

          {/* Edit fields */}
          {editing ? (
            <div className={styles.editForm}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
              />
              <div className={styles.editFormRow}>
                <Input
                  className={styles.formRowInputFlex}
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  placeholder="Equipment"
                />
                <Input
                  className={styles.formRowInputFlex}
                  value={contextLabel}
                  onChange={(e) => setContextLabel(e.target.value)}
                  placeholder="Context label"
                />
                <Select
                  value={defaultBlock}
                  onChange={(e) => setDefaultBlock(e.target.value)}
                >
                  {BLOCK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </Select>
              </div>
              <FormRow>
                <Button variant="primary" onClick={saveExercise}>Save</Button>
                <Button onClick={() => setEditing(false)}>Cancel</Button>
              </FormRow>
            </div>
          ) : (
            <div className={styles.actionButtons}>
              <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="danger" size="sm" onClick={deleteExercise}>Delete</Button>
            </div>
          )}

          {/* Tracker contributions */}
          <Card>
            <div className={styles.contribHeader}>
              Tracker Contributions
            </div>
            {loadingContribs && (
              <p className={styles.contribLoading}>Loading...</p>
            )}
            {contributions.length === 0 && !loadingContribs && (
              <p className={styles.contribEmpty}>
                No tracker contributions set.
              </p>
            )}
            {contributions.map((c) => (
              <div key={c.id} className={styles.contribRow}>
                <span className={styles.contribText}>
                  <strong>{c.tracker_key}</strong>: {c.value_per_instance} per
                  instance
                </span>
                <Button variant="danger" size="sm" onClick={() => deleteContribution(c.id)}>
                  X
                </Button>
              </div>
            ))}
            <div className={styles.contribAddRow}>
              <Input
                compact
                className={styles.contribKeyInput}
                value={newTrackerKey}
                onChange={(e) => setNewTrackerKey(e.target.value)}
                placeholder="Tracker key (e.g. mileage)"
              />
              <Input
                compact
                className={styles.contribValueInput}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value"
                type="number"
              />
              <Button variant="primary" size="sm" onClick={addContribution}>
                Add
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
