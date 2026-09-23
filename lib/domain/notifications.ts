/** M07 notification kinds + priority labels */

export const NOTIFICATION_KINDS = [
  "compliance_expired",
  "compliance_expiring_soon",
  "compliance_missing",
  "agreement_ending_soon",
  "generic",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type AppNotification = {
  id: string;
  kind: string;
  priority: string;
  title: string;
  body: string | null;
  href: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
  escalated_at?: string | null;
};

export function priorityTone(priority: string): string {
  if (priority === "high") return "var(--risk)";
  if (priority === "low") return "var(--muted)";
  return "var(--accent)";
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case "compliance_expired":
      return "Expired permit";
    case "compliance_expiring_soon":
      return "Expiring permit";
    case "compliance_missing":
      return "Missing permit";
    case "agreement_ending_soon":
      return "Agreement ending";
    default:
      return "Alert";
  }
}
