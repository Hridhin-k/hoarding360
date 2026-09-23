"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/domain/activity";

export async function createOccupancyBlock(input: {
  organizationId: string;
  faceId: string;
  startsOn: string;
  endsOn: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in" };

  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, error: "Block reason required" };
  if (!input.startsOn || !input.endsOn || input.endsOn < input.startsOn) {
    return { ok: false, error: "Valid date range required" };
  }

  const { error } = await supabase.from("occupancy_periods").insert({
    organization_id: input.organizationId,
    face_id: input.faceId,
    status: "blocked",
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    block_reason: reason,
    agreement_id: null,
  });

  if (error) return { ok: false, error: error.message };

  await supabase.rpc("sync_face_occupancy", { p_face_id: input.faceId });

  await logActivity(supabase, {
    organizationId: input.organizationId,
    entityType: "board_face",
    entityId: input.faceId,
    eventType: "occupancy.blocked",
    reason,
    toValue: { starts_on: input.startsOn, ends_on: input.endsOn },
  });

  revalidatePath("/manage/availability");
  revalidatePath("/manage/boards");
  return { ok: true };
}
