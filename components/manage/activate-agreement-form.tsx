"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/pending-button";
import { useRouter } from "next/navigation";
import { activateAgreement } from "@/app/(manage)/manage/agreements/actions";

export function ActivateAgreementForm({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("Activated after revision");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-[var(--google-green)]/40 bg-white p-4">
      <h2 className="text-sm font-medium text-[var(--ink)]">Activate draft</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        M05 · Moves draft → active · re-checks face overlap · holds inventory
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-3 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        placeholder="Activation note"
      />
      {error ? <p className="mt-2 text-sm text-[var(--google-red)]">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await activateAgreement({ agreementId, reason });
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-md bg-[var(--google-green)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <Spinner /> : null}{pending ? "Activating…" : "Activate agreement"}
      </button>
    </div>
  );
}
