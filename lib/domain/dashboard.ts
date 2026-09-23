import type { OrgRole } from "@/lib/domain/status";
import { canSeeCosts, canSeeFloorRates } from "@/lib/domain/roles";

export type DashboardPersona =
  | "admin_ops"
  | "sales"
  | "compliance"
  | "finance"
  | "field"
  | "generic";

export function dashboardPersona(
  role: OrgRole | string | null | undefined,
): DashboardPersona {
  switch (role) {
    case "company_admin":
    case "operations_manager":
      return "admin_ops";
    case "sales_executive":
      return "sales";
    case "compliance_officer":
      return "compliance";
    case "finance_officer":
      return "finance";
    case "field_supervisor":
    case "field_technician":
      return "field";
    default:
      return "generic";
  }
}

export function dashboardGreeting(persona: DashboardPersona): string {
  switch (persona) {
    case "sales":
      return "Sales desk";
    case "compliance":
      return "Compliance risk";
    case "finance":
      return "Revenue & collections";
    case "field":
      return "Field ops";
    case "admin_ops":
      return "Owner OS";
    default:
      return "Dashboard";
  }
}

export { canSeeCosts, canSeeFloorRates };

/** Columns safe for PostgREST selects — never request floor/costs for sales. */
export function boardFaceRateSelect(role: OrgRole | string | null | undefined): string {
  if (canSeeFloorRates(role)) {
    return "id, board_id, face_label, card_rate_paise, floor_rate_paise, printing_charge_paise, mounting_charge_paise, occupancy_status, available_from, is_publishable";
  }
  return "id, board_id, face_label, card_rate_paise, occupancy_status, available_from, is_publishable";
}
