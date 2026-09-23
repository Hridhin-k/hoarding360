/** Status axes — never combine into one badge. */

export const LIFECYCLE_STATUSES = [
  "draft",
  "pending_verification",
  "active",
  "under_maintenance",
  "blocked",
  "non_compliant",
  "retired",
] as const;

export const COMPLIANCE_STATUSES = [
  "valid",
  "expiring_soon",
  "expired",
  "missing",
  "under_renewal",
] as const;

export const OCCUPANCY_STATUSES = [
  "vacant",
  "becoming_vacant",
  "on_hold",
  "booked_future",
  "occupied",
  "blocked",
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];
export type OccupancyStatus = (typeof OCCUPANCY_STATUSES)[number];

export const ORG_ROLES = [
  "company_admin",
  "operations_manager",
  "sales_executive",
  "compliance_officer",
  "finance_officer",
  "field_supervisor",
  "field_technician",
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];
