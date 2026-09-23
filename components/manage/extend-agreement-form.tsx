"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { extendAgreement } from "@/app/(manage)/manage/agreements/actions";

export function ExtendAgreementForm({
  agreementId,
  currentEndsOn,
}: {
  agreementId: string;
  currentEndsOn: string;
}) {
  const router = useRouter();
  const [endsOn, setEndsOn] = useState(currentEndsOn);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-4">
      <h2 className="text-sm font-medium text-[var(--ink)]">Extend / revise end date</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        M05 · Updates agreement + face lines · re-checks overlap · audited reason
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">New end date</span>
          <input
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Client extension / date correction"
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-[var(--google-red)]">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await extendAgreement({ agreementId, endsOn, reason });
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
        className="mt-3 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save new end date"}
      </button>
    </div>
  );
}
