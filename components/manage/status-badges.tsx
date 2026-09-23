import type {
  ComplianceStatus,
  LifecycleStatus,
  OccupancyStatus,
} from "@/lib/domain/status";
import { COMPLIANCE_BADGE } from "@/lib/domain/compliance";

const LIFECYCLE_CLASS: Record<string, string> = {
  draft: "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]",
  pending_verification: "border border-[var(--primary)] bg-white text-[var(--primary)]",
  active: "border border-[var(--google-green)] bg-white text-[var(--google-green)]",
  under_maintenance:
    "border border-[var(--google-yellow)] bg-[var(--google-yellow)] text-[var(--text-primary)]",
  blocked: "border border-[var(--google-red)] bg-white text-[var(--google-red)]",
  non_compliant: "border border-[var(--google-red)] bg-white text-[var(--google-red)]",
  retired: "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
};

const OCCUPANCY_CLASS: Record<string, string> = {
  vacant: "border border-[var(--google-green)] bg-white text-[var(--google-green)]",
  becoming_vacant:
    "border border-[var(--google-yellow)] bg-[var(--google-yellow)] text-[var(--text-primary)]",
  on_hold: "border border-[var(--primary)] bg-white text-[var(--primary)]",
  booked_future: "border border-[var(--primary)] bg-white text-[var(--primary)]",
  occupied: "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]",
  blocked: "border border-[var(--google-red)] bg-white text-[var(--google-red)]",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

/** Three independent status badges — never combine into one chip. */
export function ThreeStatusBadges({
  lifecycle,
  compliance,
  occupancy,
}: {
  lifecycle: LifecycleStatus | string | null | undefined;
  compliance: ComplianceStatus | string | null | undefined;
  occupancy: OccupancyStatus | string | null | undefined;
}) {
  const life = lifecycle ?? "draft";
  const comp = (compliance ?? "missing") as ComplianceStatus;
  const occ = occupancy ?? "vacant";
  const cBadge = COMPLIANCE_BADGE[comp] ?? COMPLIANCE_BADGE.missing;

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge
        label={`Lifecycle: ${String(life).replace(/_/g, " ")}`}
        className={LIFECYCLE_CLASS[life] ?? LIFECYCLE_CLASS.draft}
      />
      <Badge label={`Compliance: ${cBadge.label}`} className={cBadge.className} />
      <Badge
        label={`Occupancy: ${String(occ).replace(/_/g, " ")}`}
        className={OCCUPANCY_CLASS[occ] ?? OCCUPANCY_CLASS.vacant}
      />
    </div>
  );
}

export function worstOccupancy(
  statuses: (OccupancyStatus | string | null | undefined)[],
): OccupancyStatus {
  const order: OccupancyStatus[] = [
    "blocked",
    "occupied",
    "on_hold",
    "booked_future",
    "becoming_vacant",
    "vacant",
  ];
  for (const o of order) {
    if (statuses.some((s) => s === o)) return o;
  }
  return "vacant";
}
