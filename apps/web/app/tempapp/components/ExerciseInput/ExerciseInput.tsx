"use client";

import { COMMENT_MAX_LENGTH } from "@/lib/tempapp/constants";
import styles from "./ExerciseInput.module.css";

// ── Types ──

export interface SetData {
  reps: number | null;
  weight: number | null;
  weightUnit: string;
  timeSeconds: number | null;
  rpe: number | null;
}

export interface ExerciseInputProps {
  name: string;
  equipment?: string;
  contextLabel?: string;
  sets: SetData[];
  restSeconds: number | null;
  lastWeekSets: SetData[] | null;
  comment: string;
  onSetsChange: (sets: SetData[]) => void;
  onRestChange: (rest: number | null) => void;
  onCommentChange: (comment: string) => void;
}

// ── Diff logic ──

type DiffResult = { direction: "up" | "down" | "same" | "none"; prev: number | null; delta: number };

function diffNum(current: number | null, prev: number | null, higherIsBetter: boolean): DiffResult {
  if (current === null || prev === null) return { direction: "none", prev, delta: 0 };
  if (current === prev) return { direction: "same", prev, delta: 0 };
  const delta = current - prev;
  const isUp = higherIsBetter ? delta > 0 : delta < 0;
  return { direction: isUp ? "up" : "down", prev, delta };
}

function DiffDisplay({ diff, unit }: { diff: DiffResult; unit?: string }) {
  if (diff.direction === "none") return <div className={styles.diffNone}>&nbsp;</div>;

  const cls =
    diff.direction === "up" ? styles.diffUp :
    diff.direction === "down" ? styles.diffDown :
    styles.diffSame;

  const arrow =
    diff.direction === "up" ? "▲" :
    diff.direction === "down" ? "▼" :
    "=";

  const deltaStr = diff.delta !== 0
    ? `${diff.delta > 0 ? "+" : ""}${diff.delta}${unit ? " " + unit : ""}`
    : "same";

  return (
    <div className={cls}>
      <span className={styles.diffArrow}>{arrow}</span>
      <span className={styles.diffPrev}>{diff.prev}{unit ? " " + unit : ""}</span>
      <span className={styles.diffDelta}>({deltaStr})</span>
    </div>
  );
}

// ── Set row ──

function SetRow({
  index,
  set,
  prevSet,
  onChange,
}: {
  index: number;
  set: SetData;
  prevSet: SetData | null;
  onChange: (updated: SetData) => void;
}) {
  const repsDiff = diffNum(set.reps, prevSet?.reps ?? null, true);
  const weightDiff = diffNum(set.weight, prevSet?.weight ?? null, true);
  const timeDiff = diffNum(set.timeSeconds, prevSet?.timeSeconds ?? null, true);
  const rpeDiff = diffNum(set.rpe, prevSet?.rpe ?? null, false); // lower RPE = easier = "better"

  function update(field: keyof SetData, raw: string) {
    if (field === "weightUnit") {
      onChange({ ...set, weightUnit: raw });
      return;
    }
    const val = raw === "" ? null : Number(raw);
    onChange({ ...set, [field]: val });
  }

  return (
    <div className={styles.setRow}>
      <div className={styles.setLabel}>Set {index + 1}</div>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Reps</label>
          <input
            className={styles.fieldInput}
            type="number"
            inputMode="numeric"
            value={set.reps ?? ""}
            onChange={(e) => update("reps", e.target.value)}
            placeholder="—"
          />
          <DiffDisplay diff={repsDiff} />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Weight</label>
          <input
            className={styles.fieldInput}
            type="number"
            inputMode="decimal"
            value={set.weight ?? ""}
            onChange={(e) => update("weight", e.target.value)}
            placeholder="—"
          />
          <DiffDisplay diff={weightDiff} unit={set.weightUnit} />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Time (s)</label>
          <input
            className={styles.fieldInput}
            type="number"
            inputMode="numeric"
            value={set.timeSeconds ?? ""}
            onChange={(e) => update("timeSeconds", e.target.value)}
            placeholder="—"
          />
          <DiffDisplay diff={timeDiff} unit="s" />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>RPE</label>
          <input
            className={styles.fieldInput}
            type="number"
            inputMode="decimal"
            min={1}
            max={10}
            step={0.5}
            value={set.rpe ?? ""}
            onChange={(e) => update("rpe", e.target.value)}
            placeholder="—"
          />
          <DiffDisplay diff={rpeDiff} />
        </div>
      </div>
    </div>
  );
}

// ── Rest separator ──

function RestSeparator({
  seconds,
  onChange,
}: {
  seconds: number | null;
  onChange: (s: number | null) => void;
}) {
  return (
    <div className={styles.restRow}>
      <div className={styles.restLine} />
      <div className={styles.restLabel}>
        Rest
        <input
          className={styles.restInput}
          type="number"
          inputMode="numeric"
          value={seconds ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="—"
        />
        s
      </div>
      <div className={styles.restLine} />
    </div>
  );
}

// ── Main component ──

export function ExerciseInput({
  name,
  equipment,
  contextLabel,
  sets,
  restSeconds,
  lastWeekSets,
  comment,
  onSetsChange,
  onRestChange,
  onCommentChange,
}: ExerciseInputProps) {
  function updateSet(index: number, updated: SetData) {
    const next = [...sets];
    next[index] = updated;
    onSetsChange(next);
  }

  function addSet() {
    const last = sets[sets.length - 1];
    const newSet: SetData = last
      ? { ...last }
      : { reps: null, weight: null, weightUnit: "lbs", timeSeconds: null, rpe: null };
    onSetsChange([...sets, newSet]);
  }

  function removeLastSet() {
    if (sets.length <= 1) return;
    onSetsChange(sets.slice(0, -1));
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.name}>{name}</span>
        {equipment && <span className={styles.tag}>{equipment}</span>}
        {contextLabel && <span className={styles.tagContext}>{contextLabel}</span>}
      </div>

      {/* Sets */}
      {sets.map((set, i) => {
        const prevSet: SetData | null = (lastWeekSets && i < lastWeekSets.length) ? lastWeekSets[i]! : null;
        return (
          <div key={i}>
            {i > 0 && <RestSeparator seconds={restSeconds} onChange={onRestChange} />}
            <SetRow index={i} set={set} prevSet={prevSet} onChange={(s) => updateSet(i, s)} />
          </div>
        );
      })}

      {/* Add/remove */}
      <div className={styles.footer}>
        <button className={styles.addBtn} onClick={addSet}>+ Add Set</button>
        {sets.length > 1 && (
          <button className={styles.removeBtn} onClick={removeLastSet}>− Remove Set</button>
        )}
      </div>

      {/* Comment */}
      <div className={styles.commentRow}>
        <input
          className={styles.commentInput}
          value={comment}
          onChange={(e) => onCommentChange(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
          placeholder="Note (optional)"
          maxLength={COMMENT_MAX_LENGTH}
        />
        <span className={styles.commentCount}>{comment.length}/{COMMENT_MAX_LENGTH}</span>
      </div>
    </div>
  );
}
