"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import type { Exercise, CompletedExercise } from "@/lib/tempapp/types";
import {
  Card,
  CardHeader,
  Badge,
  EmptyState,
  PageHeader,
  ListItem,
} from "../../components";
import styles from "./page.module.css";

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
    <div className={styles.page}>
      <div>
        <Link href="/tempapp/history" className={styles.backLink}>
          &larr; Back to History
        </Link>
        <PageHeader title={exercise.name} />
        <div className={styles.badgeRow}>
          {exercise.equipment && (
            <Badge variant="equipment">{exercise.equipment}</Badge>
          )}
          {exercise.context_label && (
            <Badge variant="context">{exercise.context_label}</Badge>
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
        <EmptyState>
          {dataPoints.length === 0
            ? "No data to chart yet."
            : "Need at least 2 data points for a chart."}
        </EmptyState>
      )}

      {/* Full history */}
      <Card>
        <CardHeader>
          <span>All Entries ({history.length})</span>
        </CardHeader>
        {history.length === 0 && (
          <p className={styles.emptyText}>
            No history entries.
          </p>
        )}
        {history.map((h, idx) => (
          <div
            key={`${h.id}-${idx}`}
            className={h.skipped ? styles.entryItemSkipped : styles.entryItem}
          >
            <div className={styles.entryHeader}>
              <span className={styles.entryDate}>
                {h.date ?? "Unknown date"}
                {h.skipped ? " (skipped)" : ""}
              </span>
              <Badge variant="blockType">{h.block_type}</Badge>
            </div>
            <div className={styles.entryMetrics}>
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
              <div className={styles.entryComment}>{h.comment}</div>
            )}
          </div>
        ))}
      </Card>
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
    <Card className={styles.chartCard}>
      <canvas
        ref={canvasRef}
        width={860}
        height={300}
        className={styles.canvas}
      />
    </Card>
  );
}
