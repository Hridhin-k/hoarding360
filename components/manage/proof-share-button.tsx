"use client";

import { useState, useTransition } from "react";
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
        className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
      >
        {pending ? "Creating…" : "Create shareable proof link"}
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
