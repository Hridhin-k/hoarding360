"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ACTIONS = [
  { label: "Add board", href: "/manage/boards/new", keys: "b" },
  { label: "New client", href: "/manage/clients/new", keys: "c" },
  { label: "New agreement", href: "/manage/agreements/new", keys: "a" },
  { label: "Import", href: "/manage/import", keys: "i" },
  { label: "Availability", href: "/manage/availability", keys: "v" },
  { label: "Compliance", href: "/manage/compliance", keys: "p" },
  { label: "Incidents", href: "/manage/incidents", keys: "n" },
  { label: "Activity log", href: "/manage/activity", keys: "l" },
  { label: "Reports", href: "/manage/reports", keys: "r" },
  { label: "Settings", href: "/manage/settings", keys: "s" },
  { label: "Heat calendar", href: "/manage/calendar", keys: "h" },
  { label: "Proof review", href: "/manage/proof-review", keys: "g" },
] as const;

export function ManageQuickAdd() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return ACTIONS;
    return ACTIONS.filter(
      (a) => a.label.toLowerCase().includes(term) || a.keys.includes(term),
    );
  }, [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] sm:inline-flex"
        title="Quick add (⌘K)"
      >
        ⌘K
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[15vh] px-4">
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-lg"
        role="dialog"
        aria-label="Quick add"
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Quick add / jump…"
          className="w-full border-b border-[var(--border)] px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-72 overflow-auto py-1">
          {filtered.map((a) => (
            <li key={a.href}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-[var(--wash)]"
                onClick={() => {
                  setOpen(false);
                  setQ("");
                  router.push(a.href);
                }}
              >
                <span>{a.label}</span>
                <span className="text-xs text-[var(--muted)]">{a.keys}</span>
              </button>
            </li>
          ))}
          {!filtered.length ? (
            <li className="px-4 py-3 text-sm text-[var(--muted)]">No matches</li>
          ) : null}
        </ul>
        <p className="border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--muted)]">
          Esc to close · ⌘K to toggle
        </p>
      </div>
      <button
        type="button"
        className="absolute inset-0 -z-10 cursor-default"
        aria-label="Close"
        onClick={() => setOpen(false)}
      />
    </div>
  );
}
