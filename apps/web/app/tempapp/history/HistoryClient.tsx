"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Exercise, CompletedExercise } from "@/lib/tempapp/types";
import { BLOCK_TYPES } from "@/lib/tempapp/types";
import { HISTORY_PAGE_SIZE } from "@/lib/tempapp/constants";
import {
  Button,
  Card,
  FormField,
  Select,
  Input,
  Badge,
  PageHeader,
} from "../components";
import styles from "./page.module.css";

interface CompletedExerciseWithName extends CompletedExercise {
  exercise_name?: string;
  date?: string;
}

interface HistoryClientProps {
  exercises: Exercise[];
}

export default function HistoryClient({ exercises }: HistoryClientProps) {
  const [results, setResults] = useState<CompletedExerciseWithName[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedExercise, setSelectedExercise] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [blockType, setBlockType] = useState("");

  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // This useEffect is legitimate synchronization: filter state -> search results
  useEffect(() => {
    search(0);
  }, [selectedExercise, startDate, endDate, blockType]);

  async function search(pageNum: number) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (selectedExercise) params.set("exercise_id", selectedExercise);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (blockType) params.set("block_type", blockType);
    params.set("limit", String(HISTORY_PAGE_SIZE));
    params.set("offset", String(pageNum * HISTORY_PAGE_SIZE));

    try {
      const res = await fetch(`/api/tempapp/completed-exercises?${params}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data: CompletedExerciseWithName[] = await res.json();
      if (pageNum === 0) {
        setResults(data);
      } else {
        setResults((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === HISTORY_PAGE_SIZE);
      setPage(pageNum);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch history");
    } finally {
      setLoading(false);
    }
  }

  // Map exercise IDs to names
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  return (
    <div className={styles.page}>
      <PageHeader title="Workout History" />

      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Filters */}
      <Card>
        <div className={styles.filterBar}>
          <FormField label="Exercise" compact>
            <Select
              compact
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
            >
              <option value="">All exercises</option>
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                  {ex.equipment ? ` (${ex.equipment})` : ""}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="From" compact>
            <Input
              compact
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FormField>
          <FormField label="To" compact>
            <Input
              compact
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FormField>
          <FormField label="Block Type" compact>
            <Select
              compact
              value={blockType}
              onChange={(e) => setBlockType(e.target.value)}
            >
              <option value="">All types</option>
              {BLOCK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </FormField>
          <Button
            size="sm"
            onClick={() => {
              setSelectedExercise("");
              setStartDate("");
              setEndDate("");
              setBlockType("");
            }}
          >
            Clear
          </Button>
        </div>
      </Card>

      {loading && results.length === 0 && <p>Loading...</p>}

      {/* Results */}
      <Card>
        {/* Header */}
        <div className={styles.historyHeader}>
          <span>Date</span>
          <span>Exercise</span>
          <span>Block</span>
          <span>Sets</span>
          <span>Reps</span>
          <span>Weight</span>
          <span>RPE</span>
          <span>Comment</span>
        </div>

        {results.length === 0 && !loading && (
          <p className={styles.emptyText}>
            No history records found.
          </p>
        )}

        {results.map((r, idx) => {
          const ex = exerciseMap.get(r.exercise_id);
          const exName = r.exercise_name ?? ex?.name ?? "Unknown";
          return (
            <div
              key={`${r.id}-${idx}`}
              className={r.skipped ? styles.historyRowSkipped : styles.historyRow}
            >
              <span className={styles.dateCell}>
                <span className={styles.historyLabel}>Date: </span>
                {new Date(r.completed_workout_id).toLocaleDateString() || "\u2014"}
              </span>
              <Link
                href={`/tempapp/history/${r.exercise_id}`}
                className={styles.exerciseLink}
              >
                {exName}
                {r.skipped ? " (skipped)" : ""}
              </Link>
              <span>
                <span className={styles.historyLabel}>Block: </span>
                <Badge variant="blockType">{r.block_type}</Badge>
              </span>
              <span><span className={styles.historyLabel}>Sets: </span>{r.sets ?? "\u2014"}</span>
              <span><span className={styles.historyLabel}>Reps: </span>{r.reps ?? "\u2014"}</span>
              <span>
                <span className={styles.historyLabel}>Weight: </span>
                {r.weight !== null ? `${r.weight} ${r.weight_unit}` : "\u2014"}
              </span>
              <span><span className={styles.historyLabel}>RPE: </span>{r.rpe ?? "\u2014"}</span>
              <span className={styles.commentCell}><span className={styles.historyLabel}>Comment: </span>{r.comment ?? ""}</span>
            </div>
          );
        })}
      </Card>

      {hasMore && (
        <div className={styles.loadMoreWrap}>
          <Button onClick={() => search(page + 1)} disabled={loading}>
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      <p className={styles.recordCount}>
        {results.length} record{results.length !== 1 ? "s" : ""} shown
      </p>
    </div>
  );
}
