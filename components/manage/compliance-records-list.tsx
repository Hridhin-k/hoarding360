"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { logActivity } from "@/lib/domain/activity";
import { COMPLIANCE_BADGE } from "@/lib/domain/compliance";
import type { ComplianceStatus } from "@/lib/domain/status";
import { CompleteRenewalForm } from "@/components/manage/complete-renewal-form";
import { formatIstDate, formatInrFromPaise } from "@/lib/format";

export type ComplianceRow = {
  id: string;
  clearance_type: string;
  governing_body: string;
  reference_no: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: ComplianceStatus;
  is_mandatory: boolean;
  under_renewal: boolean;
  fee_paid_paise: number | null;
  renewal_cycle_months: number | null;
};

type Props = {
  organizationId: string;
  boardId: string;
  records: ComplianceRow[];
};

export function ComplianceRecordsList({ organizationId, boardId, records }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markUnderRenewal(id: string) {
    setBusyId(id);
    setError(null);
    const supabase = createClient();
    const { error: updError } = await supabase
      .from("compliance_records")
      .update({ under_renewal: true })
      .eq("id", id);
    setBusyId(null);
    if (updError) {
      setError(updError.message);
      return;
    }
    await logActivity(supabase, {
      organizationId,
      entityType: "compliance_record",
      entityId: id,
      eventType: "compliance.under_renewal",
      boardId,
    });
    router.refresh();
  }

  async function softDelete(id: string) {
    if (!confirm("Remove this clearance record? It will be soft-deleted.")) return;
    setBusyId(id);
    setError(null);
    const supabase = createClient();
    const { error: updError } = await supabase
      .from("compliance_records")
      .update({
        deleted_at: new Date().toISOString(),
        deletion_reason: "removed by user",
      })
      .eq("id", id);
    setBusyId(null);
    if (updError) {
      setError(updError.message);
      return;
    }
    await logActivity(supabase, {
      organizationId,
      entityType: "compliance_record",
      entityId: id,
      eventType: "compliance.soft_deleted",
      boardId,
      reason: "removed by user",
    });
    router.refresh();
  }

  if (!records.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
        No clearances yet. Add municipal licence, traffic NOC, structural certificate, etc.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}
      {records.map((r) => {
        const badge = COMPLIANCE_BADGE[r.status] ?? COMPLIANCE_BADGE.missing;
        return (
          <article
            key={r.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-[var(--ink)]">
                  {r.clearance_type.replaceAll("_", " ")}
                  {r.is_mandatory ? (
                    <span className="ml-2 text-xs text-[var(--muted)]">mandatory</span>
                  ) : null}
                </p>
                <p className="text-sm text-[var(--muted)]">{r.governing_body}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Ref {r.reference_no || "—"} · Issued {formatIstDate(r.issue_date)} · Expires{" "}
                  {formatIstDate(r.expiry_date)}
                  {r.fee_paid_paise != null
                    ? ` · Fee ${formatInrFromPaise(r.fee_paid_paise)}`
                    : ""}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {!r.under_renewal && (r.status === "expired" || r.status === "expiring_soon") ? (
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => markUnderRenewal(r.id)}
                  className="text-[var(--accent)] hover:underline disabled:opacity-50"
                >
                  Mark under renewal
                </button>
              ) : null}
              {r.under_renewal || r.status === "expired" || r.status === "expiring_soon" ? (
                <CompleteRenewalForm
                  organizationId={organizationId}
                  boardId={boardId}
                  record={{
                    id: r.id,
                    clearance_type: r.clearance_type,
                    governing_body: r.governing_body,
                    is_mandatory: r.is_mandatory,
                    renewal_cycle_months: r.renewal_cycle_months,
                  }}
                />
              ) : null}
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => softDelete(r.id)}
                className="text-[var(--risk)] hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
