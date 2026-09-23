"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/pending-button";
import { useRouter } from "next/navigation";
import { reviseAgreementAsNew } from "@/app/(manage)/manage/agreements/actions";

export function ReviseAgreementForm({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-4">
      <h2 className="text-sm font-medium text-[var(--ink)]">Revise as new version</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        M05 · Terminates this agreement, opens a draft copy with the same faces · audited
      </p>
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Scope change / commercial revision / client request"
        className="mt-3 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
      />
      {error ? <p className="mt-2 text-sm text-[var(--google-red)]">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await reviseAgreementAsNew({ agreementId, reason });
            if (!res.ok) setError(res.error);
            else router.push(`/manage/agreements/${res.id}`);
          })
        }
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-60"
      >
        {pending ? <Spinner /> : null}{pending ? "Creating draft…" : "Create revision draft"}
      </button>
    </div>
  );
}
