"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Exercise, CompletedExercise } from "@/lib/tempapp/types";

interface CompletedExerciseWithName extends CompletedExercise {
  exercise_name?: string;
}

export default function HistoryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [results, setResults] = useState<CompletedExerciseWithName[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingExercises, setLoadingExercises] = useState(true);

  // Filters
  const [selectedExercise, setSelectedExercise] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [blockType, setBlockType] = useState("");

  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetch("/api/tempapp/exercises")
      .then((r) => r.json())
      .then((data) => {
        setExercises(data.sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name)));
        setLoadingExercises(false);
      })
      .catch(() => setLoadingExercises(false));
  }, []);

  useEffect(() => {
    search(0);
  }, [selectedExercise, startDate, endDate, blockType]);

  async function search(pageNum: number) {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedExercise) params.set("exercise_id", selectedExercise);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (blockType) params.set("block_type", blockType);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(pageNum * PAGE_SIZE));

    try {
      const res = await fetch(`/api/tempapp/completed-exercises?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data: CompletedExerciseWithName[] = await res.json();
      if (pageNum === 0) {
        setResults(data);
      } else {
        setResults((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === PAGE_SIZE);
      setPage(pageNum);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  // Map exercise IDs to names
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h1 className="tempapp-h1" style={{ fontSize: "24px", fontWeight: 700 }}>Workout History</h1>

      {/* Filters */}
      <div
        className="tempapp-filter-bar"
        style={{
          border: "1px solid #e5e7eb",
          background: "white",
          padding: "16px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "#666" }}>Exercise</label>
          <select
            className="tempapp-select"
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            style={{ padding: "8px", border: "1px solid #e5e7eb", minWidth: "180px" }}
            disabled={loadingExercises}
          >
            <option value="">All exercises</option>
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
                {ex.equipment ? ` (${ex.equipment})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "#666" }}>From</label>
          <input
            className="tempapp-input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: "8px", border: "1px solid #e5e7eb" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "#666" }}>To</label>
          <input
            className="tempapp-input"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: "8px", border: "1px solid #e5e7eb" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "#666" }}>Block Type</label>
          <select
            className="tempapp-select"
            value={blockType}
            onChange={(e) => setBlockType(e.target.value)}
            style={{ padding: "8px", border: "1px solid #e5e7eb" }}
          >
            <option value="">All types</option>
            <option value="warmup">Warmup</option>
            <option value="strength">Strength</option>
            <option value="rehab">Rehab</option>
            <option value="cardio">Cardio</option>
            <option value="stretching">Stretching</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <button
          className="touch-btn"
          onClick={() => {
            setSelectedExercise("");
            setStartDate("");
            setEndDate("");
            setBlockType("");
          }}
          style={{
            padding: "8px 16px",
            border: "1px solid #e5e7eb",
            background: "white",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Clear
        </button>
      </div>

      {loading && results.length === 0 && <p>Loading...</p>}

      {/* Results */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "white",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="tempapp-history-header"
          style={{
            display: "grid",
            gridTemplateColumns: "100px 1fr 100px 80px 80px 80px 60px 1fr",
            padding: "8px 12px",
            borderBottom: "1px solid #e5e7eb",
            background: "#f3f4f6",
            fontSize: "12px",
            fontWeight: 600,
            color: "#666",
            gap: "8px",
          }}
        >
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
          <p style={{ padding: "16px", color: "#666", fontSize: "14px" }}>
            No history records found.
          </p>
        )}

        {results.map((r, idx) => {
          const ex = exerciseMap.get(r.exercise_id);
          const exName = r.exercise_name ?? ex?.name ?? "Unknown";
          return (
            <div
              key={`${r.id}-${idx}`}
              className="tempapp-history-row"
              style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr 100px 80px 80px 80px 60px 1fr",
                padding: "8px 12px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: "13px",
                gap: "8px",
                opacity: r.skipped ? 0.5 : 1,
              }}
            >
              <span style={{ color: "#666" }}>
                <span className="history-label">Date: </span>
                {new Date(r.completed_workout_id).toLocaleDateString() || "—"}
              </span>
              <Link
                href={`/tempapp/history/${r.exercise_id}`}
                style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
              >
                {exName}
                {r.skipped ? " (skipped)" : ""}
              </Link>
              <span>
                <span className="history-label">Block: </span>
                <span
                  style={{
                    fontSize: "11px",
                    background: "#e5e7eb",
                    padding: "1px 4px",
                  }}
                >
                  {r.block_type}
                </span>
              </span>
              <span><span className="history-label">Sets: </span>{r.sets ?? "—"}</span>
              <span><span className="history-label">Reps: </span>{r.reps ?? "—"}</span>
              <span>
                <span className="history-label">Weight: </span>
                {r.weight !== null ? `${r.weight} ${r.weight_unit}` : "—"}
              </span>
              <span><span className="history-label">RPE: </span>{r.rpe ?? "—"}</span>
              <span style={{ color: "#666" }}><span className="history-label">Comment: </span>{r.comment ?? ""}</span>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          className="touch-btn"
          onClick={() => search(page + 1)}
          disabled={loading}
          style={{
            padding: "8px 16px",
            border: "1px solid #e5e7eb",
            background: "white",
            cursor: "pointer",
            alignSelf: "center",
          }}
        >
          {loading ? "Loading..." : "Load More"}
        </button>
      )}

      <p style={{ fontSize: "12px", color: "#999" }}>
        {results.length} record{results.length !== 1 ? "s" : ""} shown
      </p>
    </div>
  );
}
