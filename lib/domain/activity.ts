/** M08 append-only activity / audit trail */

export type ActivityEventType =
  | "board.created"
  | "board.updated"
  | "board.retired"
  | "face.created"
  | "face.updated"
  | "photo.added"
  | "compliance.created"
  | "compliance.updated"
  | "compliance.under_renewal"
  | "compliance.renewed"
  | "compliance.soft_deleted"
  | "client.created"
  | "client.updated"
  | "agreement.created"
  | "agreement.updated"
  | "agreement.terminated"
  | "agreement.extended"
  | "member.invited"
  | "organization.updated"
  | "occupancy.blocked"
  | "incident.created"
  | "incident.status_changed"
  | "import.completed"
  | "document.uploaded"
  | "document.soft_deleted"
  | "proof.pack_generated"
  | "proof.reviewed";

export type ActivityEvent = {
  id: string;
  organization_id: string | null;
  actor_id: string | null;
  actor_name?: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  board_id: string | null;
  from_value: Record<string, unknown> | null;
  to_value: Record<string, unknown> | null;
  reason: string | null;
  occurred_at: string;
};

export function activityLabel(eventType: string): string {
  const map: Record<string, string> = {
    "board.created": "Board created",
    "board.updated": "Board updated",
    "board.retired": "Board retired",
    "face.created": "Face added",
    "face.updated": "Face updated",
    "photo.added": "Photo added",
    "compliance.created": "Clearance added",
    "compliance.updated": "Clearance updated",
    "compliance.under_renewal": "Clearance marked under renewal",
    "compliance.renewed": "Clearance renewed",
    "compliance.soft_deleted": "Clearance removed",
    "client.created": "Client created",
    "client.updated": "Client updated",
    "agreement.created": "Agreement created",
    "agreement.updated": "Agreement updated",
    "agreement.terminated": "Agreement terminated",
    "agreement.extended": "Agreement extended",
    "agreement.revised": "Agreement revised",
    "agreement.activated": "Agreement activated",
    "member.invited": "Team member invited",
    "organization.updated": "Company profile updated",
    "occupancy.blocked": "Face blocked",
    "incident.created": "Incident logged",
    "incident.status_changed": "Incident status updated",
    "import.completed": "Bulk import completed",
    "document.uploaded": "Document uploaded",
    "document.soft_deleted": "Document removed",
    "proof.pack_generated": "Proof pack PDF generated",
    "proof.reviewed": "Proof geo review",
    "compliance.publish_override_granted": "Publish override granted",
    "compliance.publish_override_revoked": "Publish override revoked",
  };
  return map[eventType] ?? eventType.replace(/\./g, " · ");
}

export type LogActivityInput = {
  organizationId: string;
  entityType: string;
  entityId: string;
  eventType: ActivityEventType | string;
  boardId?: string | null;
  fromValue?: Record<string, unknown> | null;
  toValue?: Record<string, unknown> | null;
  reason?: string | null;
};

/** Fire-and-forget safe logger — never throws to callers */
export async function logActivity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: any }> },
  input: LogActivityInput,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_activity_event", {
      p_organization_id: input.organizationId,
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_event_type: input.eventType,
      p_board_id: input.boardId ?? null,
      p_from_value: input.fromValue ?? null,
      p_to_value: input.toValue ?? null,
      p_reason: input.reason ?? null,
    });
    if (error) {
      console.error("log_activity_event", error.message);
    }
  } catch (e) {
    console.error("log_activity_event", e);
  }
}
