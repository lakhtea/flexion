"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import "./tempapp.css";

const NAV_LINKS = [
  { href: "/tempapp", label: "Today" },
  { href: "/tempapp/plan", label: "Plan" },
  { href: "/tempapp/history", label: "History" },
  { href: "/tempapp/routines", label: "Routines" },
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
    <div
      className="tempapp-root"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "#fafafa",
        color: "#333",
      }}
    >
      <nav
        className="tempapp-nav"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 24px",
          borderBottom: "1px solid #e5e7eb",
          background: "white",
          gap: "24px",
        }}
      >
        <Link
          href="/tempapp"
          className="tempapp-nav-brand"
          style={{
            fontWeight: 700,
            fontSize: "18px",
            color: "#333",
            textDecoration: "none",
          }}
        >
          Flexion
        </Link>
        <div className="tempapp-nav-links" style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/tempapp"
                ? pathname === "/tempapp"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: isActive ? "#2563eb" : "#333",
                  textDecoration: "none",
                  fontWeight: isActive ? 600 : 400,
                  fontSize: "14px",
                  padding: "4px 8px",
                  borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <main
        className="tempapp-container"
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: "900px",
          padding: "24px",
          alignSelf: "center",
        }}
      >
        {children}
      </main>
    </div>
  );
}
