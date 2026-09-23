import type { OrgRole } from "@/lib/domain/status";

/** M01 module.action permission matrix — hide UI + gate server actions. */
export const MODULE_ACTIONS = [
  "boards.read",
  "boards.write",
  "boards.retire",
  "clients.read",
  "clients.write",
  "agreements.read",
  "agreements.write",
  "agreements.terminate",
  "compliance.read",
  "compliance.write",
  "compliance.override",
  "import.run",
  "settings.company",
  "settings.team",
  "settings.notify",
  "reports.export",
  "activity.read",
  "field.review_proof",
  "incidents.triage",
  "marketplace.publish",
  "floor_rates.see",
] as const;

export type ModuleAction = (typeof MODULE_ACTIONS)[number];

const ALL: ModuleAction[] = [...MODULE_ACTIONS];

const ROLE_MATRIX: Record<string, ModuleAction[] | "all"> = {
  company_admin: "all",
  operations_manager: "all",
  sales_executive: [
    "boards.read",
    "clients.read",
    "clients.write",
    "agreements.read",
    "agreements.write",
    "agreements.terminate",
    "activity.read",
    "marketplace.publish",
  ],
  finance_officer: [
    "boards.read",
    "clients.read",
    "agreements.read",
    "reports.export",
    "activity.read",
    "floor_rates.see",
  ],
  compliance_officer: [
    "boards.read",
    "compliance.read",
    "compliance.write",
    "compliance.override",
    "activity.read",
    "incidents.triage",
  ],
  field_supervisor: [
    "boards.read",
    "field.review_proof",
    "incidents.triage",
    "activity.read",
  ],
  field_technician: ["boards.read"],
};

export function can(
  role: OrgRole | string | null | undefined,
  action: ModuleAction,
): boolean {
  if (!role) return false;
  const allowed = ROLE_MATRIX[role];
  if (!allowed) return false;
  if (allowed === "all") return true;
  return allowed.includes(action);
}

export function permissionsForRole(
  role: OrgRole | string | null | undefined,
): ModuleAction[] {
  if (!role) return [];
  const allowed = ROLE_MATRIX[role];
  if (!allowed) return [];
  if (allowed === "all") return ALL;
  return allowed;
}
