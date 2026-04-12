"use client";
import styles from "./FormField.module.css";

interface FormFieldProps {
  label?: string;
  children?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function FormField({ label, children, compact, className }: FormFieldProps) {
  const cls = [styles.field, compact ? styles.compact : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      {label && <label className={styles.label}>{label}</label>}
      {children}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  compact?: boolean;
}

export function Input({ compact, className, ...props }: InputProps) {
  const cls = [styles.input, compact ? styles.compact : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return <input className={cls} {...props} />;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  compact?: boolean;
}

export function Select({ compact, className, children, ...props }: SelectProps) {
  const cls = [styles.select, compact ? styles.compact : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return <select className={cls} {...props}>{children}</select>;
}
