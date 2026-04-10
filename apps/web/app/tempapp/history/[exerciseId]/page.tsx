"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import type { Exercise, CompletedExercise } from "@/lib/tempapp/types";

interface HistoryEntry extends CompletedExercise {
  date?: string;
}

export default function ExerciseHistoryPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = use(params);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tempapp/exercises/${exerciseId}`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(
        `/api/tempapp/completed-exercises?exercise_id=${exerciseId}`
      ).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([ex, hist]) => {
        setExercise(ex);
        setHistory(hist);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [exerciseId]);

  if (loading) return <p>Loading...</p>;
  if (!exercise) return <p>Exercise not found.</p>;

  // Determine primary metric for chart
  const isCardio = exercise.default_block_type === "cardio";
  const dataPoints = history
    .filter((h) => !h.skipped)
    .map((h) => ({
      date: h.date ?? "",
      value: isCardio
        ? (h.time_seconds ?? 0)
        : (h.weight ?? 0),
      label: isCardio
        ? `${h.time_seconds ?? 0}s`
        : `${h.weight ?? 0} ${h.weight_unit}`,
    }))
    .filter((d) => d.value > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <Link
          href="/tempapp/history"
          style={{ color: "#2563eb", textDecoration: "none", fontSize: "13px" }}
        >
          &larr; Back to History
        </Link>
        <h1 className="tempapp-h1" style={{ fontSize: "24px", fontWeight: 700 }}>{exercise.name}</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          {exercise.equipment && (
            <span
              style={{
                fontSize: "12px",
                background: "#e5e7eb",
                padding: "2px 8px",
                color: "#666",
              }}
            >
              {exercise.equipment}
            </span>
          )}
          {exercise.context_label && (
            <span
              style={{
                fontSize: "12px",
                background: "#eff6ff",
                padding: "2px 8px",
                color: "#2563eb",
              }}
            >
              {exercise.context_label}
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      {dataPoints.length > 1 ? (
        <TrendChart
          dataPoints={dataPoints}
          yLabel={isCardio ? "Time (s)" : "Weight"}
        />
      ) : (
        <div
          style={{
            padding: "24px",
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            textAlign: "center",
            color: "#666",
          }}
        >
          {dataPoints.length === 0
            ? "No data to chart yet."
            : "Need at least 2 data points for a chart."}
        </div>
      )}

      {/* Full history */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "white",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            fontWeight: 600,
          }}
        >
          All Entries ({history.length})
        </div>
        {history.length === 0 && (
          <p style={{ padding: "16px", color: "#666", fontSize: "14px" }}>
            No history entries.
          </p>
        )}
        {history.map((h, idx) => (
          <div
            key={`${h.id}-${idx}`}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "12px 16px",
              borderBottom: "1px solid #e5e7eb",
              gap: "4px",
              opacity: h.skipped ? 0.5 : 1,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 500, fontSize: "14px" }}>
                {h.date ?? "Unknown date"}
                {h.skipped ? " (skipped)" : ""}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  background: "#e5e7eb",
                  padding: "1px 6px",
                }}
              >
                {h.block_type}
              </span>
            </div>
            <div style={{ fontSize: "13px", color: "#555" }}>
              {[
                h.sets !== null ? `${h.sets} sets` : null,
                h.reps !== null ? `${h.reps} reps` : null,
                h.weight !== null ? `${h.weight} ${h.weight_unit}` : null,
                h.time_seconds !== null ? `${h.time_seconds}s` : null,
                h.rpe !== null ? `RPE ${h.rpe}` : null,
                h.rest_seconds !== null ? `Rest ${h.rest_seconds}s` : null,
              ]
                .filter(Boolean)
                .join(" | ")}
            </div>
            {h.comment && (
              <div style={{ fontSize: "12px", color: "#666" }}>{h.comment}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({
  dataPoints,
  yLabel,
}: {
  dataPoints: Array<{ date: string; value: number; label: string }>;
  yLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dataPoints.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const pad = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    const values = dataPoints.map((d) => d.value);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1;
    const range = maxVal - minVal || 1;

    function xPos(i: number): number {
      return pad.left + (i / (dataPoints.length - 1)) * chartW;
    }

    function yPos(v: number): number {
      return pad.top + chartH - ((v - minVal) / range) * chartH;
    }

    // Axes
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.lineTo(pad.left + chartW, pad.top + chartH);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = "#999";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = minVal + (range * i) / steps;
      const y = yPos(val);
      ctx.fillText(Math.round(val).toString(), pad.left - 8, y + 4);
      ctx.strokeStyle = "#f3f4f6";
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
    }

    // Y-axis label
    ctx.save();
    ctx.translate(12, pad.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "#666";
    ctx.font = "12px sans-serif";
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // X-axis labels (show a few dates)
    ctx.textAlign = "center";
    ctx.fillStyle = "#999";
    ctx.font = "10px sans-serif";
    const labelStep = Math.max(1, Math.floor(dataPoints.length / 6));
    for (let i = 0; i < dataPoints.length; i += labelStep) {
      const x = xPos(i);
      const dateStr = dataPoints[i]!.date;
      const short = dateStr.slice(5); // MM-DD
      ctx.fillText(short, x, pad.top + chartH + 16);
    }

    // Line
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < dataPoints.length; i++) {
      const x = xPos(i);
      const y = yPos(dataPoints[i]!.value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Dots
    ctx.fillStyle = "#2563eb";
    for (let i = 0; i < dataPoints.length; i++) {
      const x = xPos(i);
      const y = yPos(dataPoints[i]!.value);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [dataPoints, yLabel]);

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        background: "white",
        padding: "16px",
      }}
    >
      <canvas
        ref={canvasRef}
        width={860}
        height={300}
        style={{ width: "100%", height: "auto" }}
      />
    </div>
  );
}
