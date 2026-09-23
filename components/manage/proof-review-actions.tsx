"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { reviewProof } from "@/app/(manage)/manage/proof-review/actions";
import { Spinner } from "@/components/ui/pending-button";

export function ProofReviewActions({ proofId }: { proofId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<"approved" | "rejected" | "waived" | null>(null);

  const [pending, startTransition] = useTransition();

  function act(status: "approved" | "rejected" | "waived") {
    setActing(status);
    startTransition(async () => {
      setError(null);
      const res = await reviewProof({ proofId, status, notes });
      setActing(null);
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
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--google-green)] px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-60"
        >
          {acting === "approved" ? <Spinner className="size-3" /> : null}
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("waived")}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs hover:bg-[var(--surface)] disabled:opacity-60"
        >
          {acting === "waived" ? <Spinner className="size-3" /> : null}
          Waive geo
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("rejected")}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--google-red)] px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-60"
        >
          {acting === "rejected" ? <Spinner className="size-3" /> : null}
          Reject
        </button>
      </div>
    </div>
  );
}
