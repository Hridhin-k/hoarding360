"use client";

import { useDeferredValue, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Hit = {
  kind: "board" | "client" | "agreement";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export function ManageGlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q.trim());
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (deferred.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const supabase = createClient();
      const like = `%${deferred}%`;
      const [{ data: byCode }, { data: byName }, { data: clients }, { data: agreements }] =
        await Promise.all([
          supabase
            .from("boards")
            .select("id, board_code, name, city")
            .is("deleted_at", null)
            .ilike("board_code", like)
            .limit(5),
          supabase
            .from("boards")
            .select("id, board_code, name, city")
            .is("deleted_at", null)
            .ilike("name", like)
            .limit(5),
          supabase
            .from("clients")
            .select("id, name, gstin")
            .is("deleted_at", null)
            .ilike("name", like)
            .limit(5),
          supabase
            .from("agreements")
            .select("id, ref_code, status, clients(name)")
            .is("deleted_at", null)
            .ilike("ref_code", like)
            .limit(5),
        ]);

      if (cancelled) return;

      const boardMap = new Map<
        string,
        { id: string; board_code: string; name: string; city: string | null }
      >();
      for (const b of [...(byCode ?? []), ...(byName ?? [])]) {
        boardMap.set(b.id, b);
      }

      const next: Hit[] = [];
      for (const b of boardMap.values()) {
        next.push({
          kind: "board",
          id: b.id,
          title: `${b.board_code} · ${b.name}`,
          subtitle: b.city ?? "Board",
          href: `/manage/boards/${b.id}`,
        });
      }
      for (const c of clients ?? []) {
        next.push({
          kind: "client",
          id: c.id,
          title: c.name,
          subtitle: c.gstin ? `GST ${c.gstin}` : "Client",
          href: `/manage/clients/${c.id}`,
        });
      }
      for (const a of agreements ?? []) {
        const client = Array.isArray(a.clients) ? a.clients[0] : a.clients;
        next.push({
          kind: "agreement",
          id: a.id,
          title: a.ref_code || a.id.slice(0, 8),
          subtitle: `${(client as { name?: string } | null)?.name ?? "Client"} · ${a.status}`,
          href: `/manage/agreements/${a.id}`,
        });
      }
      setHits(next);
      setLoading(false);
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [deferred]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <div className="relative min-w-0 flex-1 max-w-md">
      <label className="sr-only" htmlFor={listId}>
        Search Manage
      </label>
      <input
        id={listId}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // delay so click on result registers
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder="Search boards, clients, agreements…"
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
        autoComplete="off"
      />
      {open && deferred.length >= 2 ? (
        <ul className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-md border border-[var(--border)] bg-white shadow-sm">
          {loading && !hits.length ? (
            <li className="px-3 py-2 text-xs text-[var(--muted)]">Searching…</li>
          ) : null}
          {!loading && !hits.length ? (
            <li className="px-3 py-2 text-xs text-[var(--muted)]">No matches</li>
          ) : null}
          {hits.map((h) => (
            <li key={`${h.kind}-${h.id}`}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-[var(--wash)]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(h.href)}
              >
                <span className="font-medium text-[var(--ink)]">{h.title}</span>
                <span className="text-xs text-[var(--muted)]">
                  {h.kind} · {h.subtitle}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
