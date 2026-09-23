"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pendingCount } from "@/lib/field/offline-queue";
import { syncOfflineQueue } from "@/lib/field/sync";

export function FieldHomeClient({
  recentProofs,
}: {
  recentProofs: { id: string; board_code: string; geo_ok: boolean; captured_at: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void pendingCount().then(setPending);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    setOnline(navigator.onLine);
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
    setPending(await pendingCount());
    setSyncing(false);
    if (result.errors.length) {
      setMessage(result.errors[0]);
    } else {
      setMessage(
        `Synced ${result.proofsOk} proof(s), ${result.incidentsOk} incident(s).`,
      );
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">Today</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Field PWA · your tenant&apos;s site tasks · {online ? "Online" : "Offline"} · {pending}{" "}
          queued
        </p>
      </div>

      <Link
        href="/field/scan"
        className="block min-h-14 rounded-lg bg-[var(--accent)] py-4 text-center text-base font-semibold text-white"
      >
        Scan / enter QR
      </Link>

      {pending > 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium">{pending} item(s) waiting to sync</p>
          <button
            type="button"
            disabled={!online || syncing}
            onClick={() => void onSync()}
            className="mt-3 min-h-12 w-full rounded-md border border-[var(--border)] py-3 text-sm disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      ) : null}

      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Recent proofs</h2>
        {!recentProofs.length ? (
          <p className="text-sm text-[var(--muted)]">No proofs yet. Scan a board QR.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            {recentProofs.map((p) => (
              <li key={p.id} className="px-3 py-2 text-sm">
                <span className="font-medium">{p.board_code}</span>
                <span className="text-[var(--muted)]">
                  {" "}
                  · {p.geo_ok ? "geo OK" : "geo fail"} ·{" "}
                  {new Date(p.captured_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
