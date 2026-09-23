"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/pending-button";
import { useRouter } from "next/navigation";
import { terminateAgreement } from "@/app/(manage)/manage/agreements/actions";

export function TerminateAgreementForm({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-[var(--google-red)]/40 bg-white p-4">
      <h2 className="text-sm font-medium text-[var(--ink)]">Terminate agreement</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Frees inventory · requires an audited reason · never hard-deletes
      </p>
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this contract ending early?"
        className="mt-3 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
      />
      {error ? <p className="mt-2 text-sm text-[var(--google-red)]">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await terminateAgreement({ agreementId, reason });
            if (!res.ok) setError(res.error);
            else {
              router.refresh();
            }
          })
        }
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-md bg-[var(--google-red)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <Spinner /> : null}{pending ? "Terminating…" : "Terminate"}
      </button>
    </div>
  );
}
