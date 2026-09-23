"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/pending-button";
import { useRouter } from "next/navigation";
import {
  grantPublishOverride,
  revokePublishOverride,
} from "@/app/(manage)/manage/compliance/actions";

type Props = {
  boardId: string;
  canOverride: boolean;
  overrideUntil: string | null;
  overrideReason: string | null;
  hasExpiredMandatory: boolean;
};

export function PublishOverrideForm({
  boardId,
  canOverride,
  overrideUntil,
  overrideReason,
  hasExpiredMandatory,
}: Props) {
  const router = useRouter();
  const [until, setUntil] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canOverride) return null;
  if (!hasExpiredMandatory && !overrideUntil) return null;

  const active =
    overrideUntil != null && overrideUntil >= new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-lg border border-[var(--google-yellow)]/50 bg-white p-4">
      <h3 className="text-sm font-medium">Compliance publish override</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        M04 · Time-boxed · audited · max 30 days · company admin / ops only
      </p>

      {active ? (
        <div className="mt-3 space-y-2 text-sm">
          <p>
            Active until <span className="font-medium">{overrideUntil}</span>
          </p>
          {overrideReason ? (
            <p className="text-[var(--muted)]">{overrideReason}</p>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await revokePublishOverride({
                  boardId,
                  reason: "Override revoked from Board 360",
                });
                if (!res.ok) setError(res.error);
                else router.refresh();
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm hover:bg-[var(--surface)] disabled:opacity-60"
          >
            {pending ? <Spinner /> : null}{pending ? "Revoking…" : "Revoke override"}
          </button>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Until</span>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">Reason (required)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Renewal filed; awaiting certificate"
              className="rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await grantPublishOverride({ boardId, until, reason });
                if (!res.ok) setError(res.error);
                else router.refresh();
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--google-yellow)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:opacity-90 disabled:opacity-60 sm:col-span-2"
          >
            {pending ? <Spinner /> : null}{pending ? "Granting…" : "Grant temporary re-publish"}
          </button>
        </div>
      )}
      {error ? <p className="mt-2 text-sm text-[var(--google-red)]">{error}</p> : null}
    </div>
  );
}
