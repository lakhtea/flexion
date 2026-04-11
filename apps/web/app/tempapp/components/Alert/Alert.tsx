import styles from "./Alert.module.css";

interface AlertProps {
  variant: "success" | "error" | "info";
  children: React.ReactNode;
}

export function Alert({ variant, children }: AlertProps) {
  return <div className={`${styles.alert} ${styles[variant]}`}>{children}</div>;
}
