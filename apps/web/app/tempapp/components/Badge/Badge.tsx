import styles from "./Badge.module.css";

interface BadgeProps {
  variant?: "equipment" | "context" | "blockType";
  children: React.ReactNode;
}

export function Badge({ variant = "equipment", children }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>;
}
