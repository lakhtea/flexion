"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./layout.module.css";

const NAV_LINKS = [
  { href: "/tempapp", label: "Today" },
  { href: "/tempapp/plan", label: "Plan" },
  { href: "/tempapp/history", label: "History" },
  { href: "/tempapp/routines", label: "Routines" },
  { href: "/tempapp/training-blocks", label: "Training Blocks" },
  { href: "/tempapp/tracker", label: "Tracker" },
  { href: "/tempapp/exercises", label: "Exercises" },
];

export default function TempAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <Link href="/tempapp" className={styles.brand}>
          Flexion
        </Link>
        <div className={styles.navLinks}>
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/tempapp"
                ? pathname === "/tempapp"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
