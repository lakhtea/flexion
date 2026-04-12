import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  children: React.ReactNode;
  className?: string;
}

export function EmptyState({ children, className }: EmptyStateProps) {
  return <div className={`${styles.empty} ${className ?? ""}`}>{children}</div>;
}
