"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { logActivity } from "@/lib/domain/activity";

const inputClass =
  "rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]";

type Props = {
  organizationId: string;
  boardId: string;
  record: {
    id: string;
    clearance_type: string;
    governing_body: string;
    is_mandatory: boolean;
    renewal_cycle_months: number | null;
  };
};

/** M04 · Complete renewal: new certificate supersedes the old record. */
export function CompleteRenewalForm({ organizationId, boardId, record }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [referenceNo, setReferenceNo] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [feeRupees, setFeeRupees] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expiryDate) {
      setError("New expiry date is required.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const fee = feeRupees.trim() ? Math.round(Number(feeRupees) * 100) : null;

    const { data: neu, error: insertError } = await supabase
      .from("compliance_records")
      .insert({
        organization_id: organizationId,
        board_id: boardId,
        clearance_type: record.clearance_type,
        governing_body: record.governing_body,
        reference_no: referenceNo.trim() || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate,
        renewal_cycle_months: record.renewal_cycle_months,
        fee_paid_paise: fee != null && !Number.isNaN(fee) ? fee : null,
        is_mandatory: record.is_mandatory,
        under_renewal: false,
        supersedes_id: record.id,
        notes: notes.trim() || `Renewed from ${record.id.slice(0, 8)}`,
      })
      .select("id")
      .single();

    if (insertError || !neu) {
      setLoading(false);
      setError(insertError?.message ?? "Could not save renewed clearance");
      return;
    }

    await supabase
      .from("compliance_records")
      .update({
        under_renewal: false,
        deleted_at: new Date().toISOString(),
        deletion_reason: `superseded by renewal ${neu.id}`,
      })
      .eq("id", record.id);

    await logActivity(supabase, {
      organizationId,
      entityType: "compliance_record",
      entityId: neu.id,
      eventType: "compliance.renewed",
      boardId,
      fromValue: { id: record.id },
      toValue: { id: neu.id, expiry_date: expiryDate },
      reason: "certificate renewed",
    });

    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[var(--primary)] hover:underline"
      >
        Complete renewal
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 grid gap-2 rounded-md border border-[var(--border)] bg-white p-3 sm:grid-cols-2"
    >
      <p className="sm:col-span-2 text-xs text-[var(--muted)]">
        Creates a new clearance that supersedes this one · old record soft-deleted
      </p>
      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">New reference</span>
        <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className={inputClass} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Fee ₹</span>
        <input value={feeRupees} onChange={(e) => setFeeRupees(e.target.value)} className={inputClass} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Issue date</span>
        <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Expiry date *</span>
        <input
          required
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">
        <span className="text-[var(--muted)]">Notes</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </label>
      {error ? <p className="sm:col-span-2 text-sm text-[var(--google-red)]">{error}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save renewed certificate"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
