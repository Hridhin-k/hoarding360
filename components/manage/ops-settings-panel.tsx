"use client";

import { useState, useTransition } from "react";
import {
  saveOpsSettings,
  upsertClearanceType,
} from "@/app/(manage)/manage/settings/ops-actions";

type ClearanceType = {
  id: string;
  code: string;
  label: string;
  is_mandatory_default: boolean;
  active: boolean;
};

type Props = {
  organizationId: string;
  prelistingWindowDays: number;
  alertEscalateAfterHours: number;
  clearanceTypes: ClearanceType[];
};

export function OpsSettingsPanel({
  organizationId,
  prelistingWindowDays,
  alertEscalateAfterHours,
  clearanceTypes,
}: Props) {
  const [days, setDays] = useState(String(prelistingWindowDays));
  const [hours, setHours] = useState(String(alertEscalateAfterHours));
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-[var(--border)] bg-white p-4">
        <h2 className="text-sm font-medium">Ops windows</h2>
        <p className="text-xs text-[var(--muted)]">
          M06 · Pre-listing window drives becoming_vacant · P2 escalation hours
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Pre-listing window (0–90 days)</span>
            <input
              type="number"
              min={0}
              max={90}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Escalate critical alerts after (hours)</span>
            <input
              type="number"
              min={1}
              max={168}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              setMessage(null);
              const res = await saveOpsSettings({
                organizationId,
                prelistingWindowDays: Number(days),
                alertEscalateAfterHours: Number(hours),
              });
              if (!res.ok) setError(res.error);
              else setMessage("Ops settings saved.");
            })
          }
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Save ops settings
        </button>
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--border)] bg-white p-4">
        <h2 className="text-sm font-medium">Clearance type catalogue</h2>
        <p className="text-xs text-[var(--muted)]">M04 · Tenant-specific types</p>
        <ul className="divide-y divide-[var(--border)] text-sm">
          {clearanceTypes.map((t) => (
            <li key={t.id} className="flex justify-between gap-2 py-2">
              <span>
                {t.label}{" "}
                <span className="text-xs text-[var(--muted)]">
                  ({t.code}
                  {t.is_mandatory_default ? " · mandatory" : ""}
                  {!t.active ? " · inactive" : ""})
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            placeholder="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          />
          <input
            placeholder="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mandatory}
            onChange={(e) => setMandatory(e.target.checked)}
          />
          Mandatory by default
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              setMessage(null);
              const res = await upsertClearanceType({
                organizationId,
                code,
                label,
                isMandatoryDefault: mandatory,
                active: true,
              });
              if (!res.ok) setError(res.error);
              else {
                setMessage("Clearance type added.");
                setCode("");
                setLabel("");
              }
            })
          }
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
        >
          Add type
        </button>
      </section>

      {error ? <p className="text-sm text-[var(--google-red)]">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--google-green)]">{message}</p> : null}
    </div>
  );
}
