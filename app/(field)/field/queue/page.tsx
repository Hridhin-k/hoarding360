"use client";

import { useEffect, useState } from "react";
import type { PendingIncident, PendingProof } from "@/lib/domain/field";
import {
  listPendingIncidents,
  listPendingProofs,
} from "@/lib/field/offline-queue";
import { syncOfflineQueue } from "@/lib/field/sync";

export default function FieldQueuePage() {
  const [proofs, setProofs] = useState<PendingProof[]>([]);
  const [incidents, setIncidents] = useState<PendingIncident[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  async function refresh() {
    setProofs(await listPendingProofs());
    setIncidents(await listPendingIncidents());
  }

  useEffect(() => {
    void refresh();
    setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      void refresh();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function onSync() {
    setSyncing(true);
    setMessage(null);
    const result = await syncOfflineQueue();
    await refresh();
    setSyncing(false);
    setMessage(
      result.errors.length
        ? result.errors[0]
        : `Synced ${result.proofsOk} proof(s), ${result.incidentsOk} incident(s).`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">Offline queue</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            IndexedDB · {online ? "Online" : "Offline"}
          </p>
        </div>
        <button
          type="button"
          disabled={!online || syncing || (!proofs.length && !incidents.length)}
          onClick={() => void onSync()}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync"}
        </button>
      </div>

      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Proofs ({proofs.length})</h2>
        {!proofs.length ? (
          <p className="text-sm text-[var(--muted)]">Empty</p>
        ) : (
          <ul className="space-y-2">
            {proofs.map((p) => (
              <li
                key={p.clientOfflineId}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {p.boardCode ?? p.boardId.slice(0, 8)} ·{" "}
                {new Date(p.capturedAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Incidents ({incidents.length})</h2>
        {!incidents.length ? (
          <p className="text-sm text-[var(--muted)]">Empty</p>
        ) : (
          <ul className="space-y-2">
            {incidents.map((i) => (
              <li
                key={i.clientOfflineId}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {i.title} · {i.boardCode ?? i.boardId.slice(0, 8)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
