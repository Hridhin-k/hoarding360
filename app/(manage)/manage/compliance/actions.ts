"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function grantPublishOverride(input: {
  boardId: string;
  until: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_compliance_publish_override", {
    p_board_id: input.boardId,
    p_reason: input.reason,
    p_until: input.until,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/manage/boards/${input.boardId}`);
  revalidatePath("/manage/compliance");
  revalidatePath("/boards");
  return { ok: true };
}

export async function revokePublishOverride(input: {
  boardId: string;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_compliance_publish_override", {
    p_board_id: input.boardId,
    p_reason: input.reason ?? "Override revoked",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/manage/boards/${input.boardId}`);
  revalidatePath("/manage/compliance");
  revalidatePath("/boards");
  return { ok: true };
}
