"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/pending-button";
import { useRouter } from "next/navigation";
import {
  createManageIncident,
  updateIncidentStatus,
} from "@/app/(manage)/manage/incidents/actions";
import { INCIDENT_CATEGORIES, INCIDENT_STATUSES } from "@/lib/domain/field";

const inputClass =
  "rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]";

export function CreateIncidentForm({
  organizationId,
  boards,
}: {
  organizationId: string;
  boards: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("damage");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-4">
      <h2 className="text-sm font-medium">Log incident</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">M11 · From Manage CRM (Field can also report)</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={boardId}
          onChange={(e) => setBoardId(e.target.value)}
          className={`${inputClass} sm:col-span-2`}
        >
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} sm:col-span-2`}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
        >
          {INCIDENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className={inputClass}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <textarea
          rows={2}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${inputClass} sm:col-span-2`}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-[var(--google-red)]">{error}</p> : null}
      <button
        type="button"
        disabled={pending || !boardId}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await createManageIncident({
              organizationId,
              boardId,
              title,
              category,
              severity,
              description,
            });
            if (!res.ok) setError(res.error);
            else {
              setTitle("");
              setDescription("");
              router.refresh();
            }
          })
        }
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <Spinner /> : null}{pending ? "Saving…" : "Create incident"}
      </button>
    </div>
  );
}

export function IncidentStatusSelect({
  incidentId,
  status,
}: {
  incidentId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          await updateIncidentStatus({
            incidentId,
            status: e.target.value as (typeof INCIDENT_STATUSES)[number],
          });
        })
      }
      className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
    >
      {INCIDENT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
