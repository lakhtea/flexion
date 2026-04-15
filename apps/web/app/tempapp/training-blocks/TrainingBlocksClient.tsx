"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TrainingBlock, TrainingBlockWithDays } from "@/lib/tempapp/types";
import {
  Button,
  Card,
  Badge,
  Input,
  Select,
  FormRow,
  EmptyState,
  PageHeader,
} from "../components";
import styles from "./page.module.css";

interface TrainingBlocksClientProps {
  initialBlocks: TrainingBlock[];
}

export default function TrainingBlocksClient({ initialBlocks }: TrainingBlocksClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<TrainingBlockWithDays | null>(null);
  const [loadingExpand, setLoadingExpand] = useState(false);

  // New block form
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCycleDays, setNewCycleDays] = useState("7");
  const [newIsRecurring, setNewIsRecurring] = useState(true);

  // Activate form
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateDate, setActivateDate] = useState("");

  async function toggleExpand(blockId: string) {
    if (expandedId === blockId) {
      setExpandedId(null);
      setExpandedData(null);
      return;
    }
    setExpandedId(blockId);
    setLoadingExpand(true);
    try {
      const res = await fetch(`/api/tempapp/training-blocks/${blockId}`);
      if (!res.ok) throw new Error("Failed to load block details");
      const data: TrainingBlockWithDays = await res.json();
      setExpandedData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load block");
    } finally {
      setLoadingExpand(false);
    }
  }

  async function createBlock() {
    if (!newName.trim()) return;
    const cycleDays = parseInt(newCycleDays, 10);
    if (isNaN(cycleDays) || cycleDays < 1) return;
    try {
      const res = await fetch("/api/tempapp/training-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          cycle_days: cycleDays,
          is_recurring: newIsRecurring ? 1 : 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to create training block");
      setNewName("");
      setNewDesc("");
      setNewCycleDays("7");
      setNewIsRecurring(true);
      setShowNew(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create training block");
    }
  }

  async function deleteBlock(id: string) {
    if (!confirm("Delete this training block?")) return;
    try {
      const res = await fetch(`/api/tempapp/training-blocks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete training block");
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedData(null);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete training block");
    }
  }

  async function activateBlock(id: string) {
    if (!activateDate) return;
    try {
      const res = await fetch(`/api/tempapp/training-blocks/${id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: activateDate }),
      });
      if (!res.ok) throw new Error("Failed to activate training block");
      setActivatingId(null);
      setActivateDate("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to activate training block");
    }
  }

  async function deactivateBlock(id: string) {
    try {
      const res = await fetch(`/api/tempapp/training-blocks/${id}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to deactivate training block");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to deactivate training block");
    }
  }

  function getCycleLabel(cycleDays: number): string {
    if (cycleDays === 7) return "Weekly";
    if (cycleDays === 14) return "Biweekly";
    return `${cycleDays}-day cycle`;
  }

  function countExercisesInDay(day: TrainingBlockWithDays["days"][number]): number {
    return day.blocks.reduce((sum, b) => sum + b.exercises.length, 0);
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Training Blocks">
        <Button variant="primary" onClick={() => setShowNew(!showNew)}>
          + New Training Block
        </Button>
      </PageHeader>

      {error && (
        <Card>
          <div className={styles.detailBody}>
            <p style={{ color: "var(--danger)" }}>{error}</p>
            <Button size="sm" onClick={() => setError(null)}>Dismiss</Button>
          </div>
        </Card>
      )}

      {showNew && (
        <Card>
          <div className={styles.newBlockForm}>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Block name (e.g. Push/Pull/Legs)"
              autoFocus
            />
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
            />
            <Select
              value={newCycleDays}
              onChange={(e) => setNewCycleDays(e.target.value)}
            >
              <option value="7">Weekly (7 days)</option>
              <option value="14">Biweekly (14 days)</option>
            </Select>
            <div className={styles.toggleRow}>
              <label>
                <input
                  type="checkbox"
                  checked={newIsRecurring}
                  onChange={(e) => setNewIsRecurring(e.target.checked)}
                />
                Recurring (repeats after cycle ends)
              </label>
            </div>
            <FormRow gap="sm">
              <Button variant="primary" onClick={createBlock}>
                Create
              </Button>
              <Button onClick={() => setShowNew(false)}>
                Cancel
              </Button>
            </FormRow>
          </div>
        </Card>
      )}

      {initialBlocks.length === 0 && !showNew && (
        <EmptyState>
          No training blocks yet. Create one to plan your training cycle.
        </EmptyState>
      )}

      {initialBlocks.map((block) => (
        <Card key={block.id}>
          <div
            onClick={() => toggleExpand(block.id)}
            className={
              expandedId === block.id
                ? styles.blockHeaderExpanded
                : styles.blockHeader
            }
          >
            <span className={styles.blockName}>{block.name}</span>
            <Badge variant="blockType">{getCycleLabel(block.cycle_days)}</Badge>
            <Badge variant={block.is_active ? "context" : "equipment"}>
              {block.is_active ? "Active" : "Inactive"}
            </Badge>
            {block.is_active && block.start_date && (
              <span className={styles.blockMeta}>
                Started {block.start_date}
              </span>
            )}
            <span className={styles.blockMeta}>
              {expandedId === block.id ? "\u25B2" : "\u25BC"}
            </span>
          </div>

          {expandedId === block.id && (
            <div className={styles.detailBody}>
              {block.description && (
                <p className={styles.blockMeta}>{block.description}</p>
              )}

              {/* Action buttons */}
              <div className={styles.actionButtons}>
                {block.is_active ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => deactivateBlock(block.id)}
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() =>
                      setActivatingId(
                        activatingId === block.id ? null : block.id
                      )
                    }
                  >
                    Activate
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => deleteBlock(block.id)}
                >
                  Delete
                </Button>
              </div>

              {/* Activate form */}
              {activatingId === block.id && (
                <div className={styles.activateForm}>
                  <span className={styles.activateLabel}>Start date:</span>
                  <Input
                    compact
                    type="date"
                    value={activateDate}
                    onChange={(e) => setActivateDate(e.target.value)}
                  />
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => activateBlock(block.id)}
                    disabled={!activateDate}
                  >
                    Activate
                  </Button>
                  <Button size="sm" onClick={() => setActivatingId(null)}>
                    Cancel
                  </Button>
                </div>
              )}

              {/* Days list */}
              {loadingExpand && <p className={styles.blockMeta}>Loading days...</p>}

              {expandedData && expandedData.id === block.id && (
                <>
                  <span className={styles.daysHeader}>
                    Cycle Days ({expandedData.days.length})
                  </span>
                  <div className={styles.daysList}>
                    {expandedData.days.map((day) => (
                      <div
                        key={day.id}
                        className={styles.dayItem}
                        onClick={() =>
                          router.push(
                            `/tempapp/training-blocks/${block.id}/day/${day.day_offset}`
                          )
                        }
                      >
                        <span className={styles.dayLabel}>
                          {day.label}
                        </span>
                        {day.is_rest_day ? (
                          <Badge variant="equipment">Rest</Badge>
                        ) : (
                          <span className={styles.dayExCount}>
                            {countExercisesInDay(day)} exercise
                            {countExercisesInDay(day) !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
