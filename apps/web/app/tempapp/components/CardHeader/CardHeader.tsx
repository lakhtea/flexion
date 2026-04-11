import styles from "./CardHeader.module.css";

interface CardHeaderProps {
  children: React.ReactNode;
  subtle?: boolean;
  className?: string;
}

export function CardHeader({ children, subtle, className }: CardHeaderProps) {
  const cls = [styles.header, subtle ? styles.subtle : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return <div className={cls}>{children}</div>;
}
