"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { reviewProof } from "@/app/(manage)/manage/proof-review/actions";

export function ProofReviewActions({ proofId }: { proofId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function act(status: "approved" | "rejected" | "waived") {
    startTransition(async () => {
      setError(null);
      const res = await reviewProof({ proofId, status, notes });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="mt-2 space-y-2">
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Review notes"
        className="w-full rounded-md border border-[var(--border)] px-2 py-1 text-xs"
      />
      {error ? <p className="text-xs text-[var(--google-red)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => act("approved")}
          className="rounded-md bg-[var(--google-green)] px-2 py-1 text-xs text-white disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("waived")}
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
        >
          Waive geo
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("rejected")}
          className="rounded-md bg-[var(--google-red)] px-2 py-1 text-xs text-white disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
