import styles from "./ListItem.module.css";

interface ListItemProps {
  children: React.ReactNode;
  clickable?: boolean;
  dimmed?: boolean;
  column?: boolean;
  className?: string;
  onClick?: () => void;
}

export function ListItem({ children, clickable, dimmed, column, className, onClick }: ListItemProps) {
  const cls = [
    styles.item,
    clickable ? styles.clickable : "",
    dimmed ? styles.dimmed : "",
    column ? styles.column : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} onClick={onClick}>
      {children}
    </div>
  );
}
