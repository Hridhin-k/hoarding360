"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/pending-button";
import { createProofShareLink } from "@/app/(manage)/manage/proof-review/actions";

export function ProofShareButton({ boardId }: { boardId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await createProofShareLink({ boardId, days: 14 });
            if (!res.ok) setError(res.error);
            else setUrl(`${window.location.origin}/share/proof/${res.token}`);
          })
        }
        className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm hover:bg-[var(--surface)]"
      >
        {pending ? <Spinner /> : null}{pending ? "Creating…" : "Create shareable proof link"}
      </button>
      {url ? (
        <p className="break-all text-xs text-[var(--primary)]">
          <a href={url} target="_blank" rel="noreferrer" className="underline">
            {url}
          </a>
        </p>
      ) : null}
      {error ? <p className="text-xs text-[var(--google-red)]">{error}</p> : null}
    </div>
  );
}
