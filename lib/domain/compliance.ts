import type { ComplianceStatus } from "@/lib/domain/status";

/** Platform default clearance types — tenants can still type custom values. */
export const DEFAULT_CLEARANCE_TYPES = [
  {
    value: "municipal_licence",
    label: "Municipal advertising licence",
    body: "Municipal Corporation",
  },
  {
    value: "traffic_police_noc",
    label: "Traffic police NOC",
    body: "Traffic Police",
  },
  {
    value: "structural_stability",
    label: "Structural stability certificate",
    body: "Licensed structural engineer",
  },
  {
    value: "electrical_safety",
    label: "Electrical safety clearance",
    body: "Electrical inspectorate",
  },
  {
    value: "landowner_permission",
    label: "Landowner permission",
    body: "Landowner",
  },
  {
    value: "highway_permission",
    label: "Highway authority permission",
    body: "NHAI / PWD",
  },
  {
    value: "fire_noc",
    label: "Fire NOC",
    body: "Fire Department",
  },
] as const;

export const COMPLIANCE_BADGE: Record<
  ComplianceStatus,
  { label: string; className: string }
> = {
  valid: {
    label: "Valid",
    className:
      "border border-[var(--google-green)] bg-white text-[var(--google-green)]",
  },
  expiring_soon: {
    label: "Expiring soon",
    className:
      "border border-[var(--google-yellow)] bg-[var(--google-yellow)] text-[var(--text-primary)]",
  },
  expired: {
    label: "Expired",
    className: "border border-[var(--google-red)] bg-white text-[var(--google-red)]",
  },
  missing: {
    label: "Missing",
    className:
      "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]",
  },
  under_renewal: {
    label: "Under renewal",
    className: "border border-[var(--primary)] bg-white text-[var(--primary)]",
  },
};

export function worstCompliance(
  statuses: ComplianceStatus[],
): ComplianceStatus | null {
  if (!statuses.length) return null;
  const order: ComplianceStatus[] = [
    "expired",
    "missing",
    "under_renewal",
    "expiring_soon",
    "valid",
  ];
  for (const s of order) {
    if (statuses.includes(s)) return s;
  }
  return statuses[0];
}

export type ComplianceFormValues = {
  clearance_type: string;
  governing_body: string;
  reference_no: string;
  issue_date: string;
  expiry_date: string;
  renewal_cycle_months: string;
  fee_rupees: string;
  is_mandatory: boolean;
  notes: string;
};

export function emptyComplianceForm(
  preset?: (typeof DEFAULT_CLEARANCE_TYPES)[number],
): ComplianceFormValues {
  return {
    clearance_type: preset?.value ?? "",
    governing_body: preset?.body ?? "",
    reference_no: "",
    issue_date: "",
    expiry_date: "",
    renewal_cycle_months: "12",
    fee_rupees: "",
    is_mandatory: true,
    notes: "",
  };
}
