"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/domain/activity";
import { INCIDENT_STATUSES, type IncidentStatus } from "@/lib/domain/field";

export async function createManageIncident(input: {
  organizationId: string;
  boardId: string;
  title: string;
  category: string;
  severity: string;
  description: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, error: "Not signed in" };

  const title = input.title.trim();
  if (title.length < 3) return { ok: false, error: "Title required" };

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      organization_id: input.organizationId,
      board_id: input.boardId,
      reported_by: userId,
      title,
      category: input.category,
      severity: input.severity,
      description: input.description.trim() || null,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create" };

  await logActivity(supabase, {
    organizationId: input.organizationId,
    entityType: "incident",
    entityId: data.id,
    eventType: "incident.created",
    boardId: input.boardId,
    toValue: { title, severity: input.severity },
  });

  revalidatePath("/manage/incidents");
  revalidatePath(`/manage/boards/${input.boardId}`);
  return { ok: true, id: data.id };
}

export async function updateIncidentStatus(input: {
  incidentId: string;
  status: IncidentStatus;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in" };
  if (!INCIDENT_STATUSES.includes(input.status)) {
    return { ok: false, error: "Invalid status" };
  }

  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.status === "resolved" || input.status === "closed") {
    patch.resolved_at = new Date().toISOString();
  }

  const { data: row, error } = await supabase
    .from("incidents")
    .update(patch)
    .eq("id", input.incidentId)
    .is("deleted_at", null)
    .select("id, organization_id, board_id, status")
    .maybeSingle();

  if (error || !row) return { ok: false, error: error?.message ?? "Not found" };

  await logActivity(supabase, {
    organizationId: row.organization_id,
    entityType: "incident",
    entityId: row.id,
    eventType: "incident.status_changed",
    boardId: row.board_id,
    toValue: { status: input.status },
  });

  revalidatePath("/manage/incidents");
  if (row.board_id) revalidatePath(`/manage/boards/${row.board_id}`);
  return { ok: true };
}
