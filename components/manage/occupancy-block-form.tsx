"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/pending-button";
import { createOccupancyBlock } from "@/app/(manage)/manage/availability/actions";

const inputClass =
  "rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]";

type FaceOption = {
  id: string;
  label: string;
};

export function OccupancyBlockForm({
  organizationId,
  faces,
}: {
  organizationId: string;
  faces: FaceOption[];
}) {
  const [faceId, setFaceId] = useState(faces[0]?.id ?? "");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-4">
      <h2 className="text-sm font-medium">Manual block</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        M06 · Maintenance / owner reserve — kept when agreements re-sync
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={faceId}
          onChange={(e) => setFaceId(e.target.value)}
          className={`${inputClass} sm:col-span-2`}
        >
          {faces.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
          className={inputClass}
        />
        <input
          type="date"
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={`${inputClass} sm:col-span-2`}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-[var(--google-red)]">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-[var(--google-green)]">{message}</p> : null}
      <button
        type="button"
        disabled={pending || !faceId}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            setMessage(null);
            const res = await createOccupancyBlock({
              organizationId,
              faceId,
              startsOn,
              endsOn,
              reason,
            });
            if (!res.ok) setError(res.error);
            else setMessage("Block saved.");
          })
        }
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm hover:bg-[var(--surface)] disabled:opacity-60"
      >
        {pending ? <Spinner /> : null}{pending ? "Saving…" : "Block dates"}
      </button>
    </div>
  );
}
