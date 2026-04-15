import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  label: string;
  current: number;
  target: number;
  unit: string;
}

export function ProgressBar({ label, current, target, unit }: ProgressBarProps) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isComplete = pct >= 100;
  return (
    <div className={styles.container}>
      <div className={styles.labelRow}>
        <span>{label}</span>
        <span>
          {current} / {target} {unit}
        </span>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${isComplete ? styles.fillGreen : styles.fillBlue}`}
          style={{ width: `${pct}%` }}
        />
        <span className={styles.pct} style={{ color: pct > 70 ? "white" : "#333" }}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}
