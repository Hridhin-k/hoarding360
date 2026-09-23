"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/pending-button";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { logActivity } from "@/lib/domain/activity";
import {
  DEFAULT_CLEARANCE_TYPES,
  emptyComplianceForm,
  type ComplianceFormValues,
} from "@/lib/domain/compliance";

const inputClass =
  "rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

type Props = {
  organizationId: string;
  boardId: string;
  clearanceTypes?: { code: string; label: string; is_mandatory_default?: boolean }[];
  onDone?: () => void;
};

export function ComplianceRecordForm({
  organizationId,
  boardId,
  clearanceTypes,
  onDone,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<ComplianceFormValues>(emptyComplianceForm());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const catalogue =
    clearanceTypes && clearanceTypes.length
      ? clearanceTypes.map((t) => ({
          value: t.code,
          label: t.label,
          body: "",
          mandatory: t.is_mandatory_default ?? false,
        }))
      : DEFAULT_CLEARANCE_TYPES.map((t) => ({
          value: t.value,
          label: t.label,
          body: t.body,
          mandatory: true,
        }));

  function applyPreset(value: string) {
    const preset = catalogue.find((t) => t.value === value);
    setValues((v) => ({
      ...v,
      clearance_type: value,
      governing_body: preset?.body || v.governing_body,
      is_mandatory: preset?.mandatory ?? v.is_mandatory,
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.clearance_type.trim() || !values.governing_body.trim()) {
      setError("Clearance type and governing body are required.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const fee = values.fee_rupees.trim()
      ? Math.round(Number(values.fee_rupees) * 100)
      : null;

    const { data: row, error: insertError } = await supabase
      .from("compliance_records")
      .insert({
        organization_id: organizationId,
        board_id: boardId,
        clearance_type: values.clearance_type.trim(),
        governing_body: values.governing_body.trim(),
        reference_no: values.reference_no.trim() || null,
        issue_date: values.issue_date || null,
        expiry_date: values.expiry_date || null,
        renewal_cycle_months: values.renewal_cycle_months
          ? Number(values.renewal_cycle_months)
          : null,
        fee_paid_paise: fee != null && !Number.isNaN(fee) ? fee : null,
        is_mandatory: values.is_mandatory,
        notes: values.notes.trim() || null,
        under_renewal: false,
      })
      .select("id")
      .single();

    setLoading(false);
    if (insertError || !row) {
      setError(insertError?.message ?? "Could not save clearance");
      return;
    }

    await logActivity(supabase, {
      organizationId,
      entityType: "compliance_record",
      entityId: row.id,
      eventType: "compliance.created",
      boardId,
      toValue: {
        clearance_type: values.clearance_type.trim(),
        expiry_date: values.expiry_date || null,
      },
    });

    setValues(emptyComplianceForm());
    setOpen(false);
    onDone?.();
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
      >
        Add clearance
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">New clearance</h3>
        <button
          type="button"
          className="text-xs text-[var(--muted)]"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Type (preset or custom)</span>
        <select
          value={
            catalogue.some((t) => t.value === values.clearance_type)
              ? values.clearance_type
              : "__custom"
          }
          onChange={(e) => {
            if (e.target.value === "__custom") {
              setValues((v) => ({ ...v, clearance_type: "" }));
            } else {
              applyPreset(e.target.value);
            }
          }}
          className={inputClass}
        >
          <option value="">Select…</option>
          {catalogue.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
          <option value="__custom">Custom…</option>
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Clearance type key / name</span>
        <input
          required
          value={values.clearance_type}
          onChange={(e) => setValues((v) => ({ ...v, clearance_type: e.target.value }))}
          className={inputClass}
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Governing body</span>
        <input
          required
          value={values.governing_body}
          onChange={(e) => setValues((v) => ({ ...v, governing_body: e.target.value }))}
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Reference no.</span>
          <input
            value={values.reference_no}
            onChange={(e) => setValues((v) => ({ ...v, reference_no: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Renewal cycle (months)</span>
          <input
            value={values.renewal_cycle_months}
            onChange={(e) =>
              setValues((v) => ({ ...v, renewal_cycle_months: e.target.value }))
            }
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Issue date</span>
          <input
            type="date"
            value={values.issue_date}
            onChange={(e) => setValues((v) => ({ ...v, issue_date: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Expiry date</span>
          <input
            type="date"
            value={values.expiry_date}
            onChange={(e) => setValues((v) => ({ ...v, expiry_date: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Fee paid (₹)</span>
          <input
            value={values.fee_rupees}
            onChange={(e) => setValues((v) => ({ ...v, fee_rupees: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm pt-6">
          <input
            type="checkbox"
            checked={values.is_mandatory}
            onChange={(e) =>
              setValues((v) => ({ ...v, is_mandatory: e.target.checked }))
            }
          />
          Mandatory (blocks publish when expired)
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Notes</span>
        <textarea
          rows={2}
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          className={inputClass}
        />
      </label>

      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {loading ? <Spinner /> : null}{loading ? "Saving…" : "Save clearance"}
      </button>
    </form>
  );
}
