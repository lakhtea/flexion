import styles from "./FormRow.module.css";

interface FormRowProps {
  children: React.ReactNode;
  wrap?: boolean;
  column?: boolean;
  center?: boolean;
  mobileColumn?: boolean;
  gap?: "sm" | "md" | "lg";
  className?: string;
}

export function FormRow({
  children,
  wrap,
  column,
  center,
  mobileColumn,
  gap = "md",
  className,
}: FormRowProps) {
  const cls = [
    styles.row,
    wrap ? styles.wrap : "",
    column ? styles.column : "",
    center ? styles.center : "",
    mobileColumn ? styles.mobileColumn : "",
    gap === "sm" ? styles.gapSm : gap === "lg" ? styles.gapLg : styles.gapMd,
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <div className={cls}>{children}</div>;
}
