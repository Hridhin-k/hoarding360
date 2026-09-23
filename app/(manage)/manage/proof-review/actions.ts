"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/domain/activity";
import { requireAction } from "@/lib/domain/authz";

export async function reviewProof(input: {
  proofId: string;
  status: "approved" | "rejected" | "waived";
  notes: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireAction("field.review_proof");
  if (!gate.ok) return { ok: false, error: gate.error };
  const { supabase, userId } = gate;

  const { data: proof, error: fetchError } = await supabase
    .from("proof_of_display")
    .select("id, organization_id, board_id, geo_ok, review_status")
    .eq("id", input.proofId)
    .maybeSingle();

  if (fetchError || !proof) return { ok: false, error: fetchError?.message ?? "Not found" };

  const { error } = await supabase
    .from("proof_of_display")
    .update({
      review_status: input.status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: input.notes.trim() || null,
    })
    .eq("id", input.proofId);

  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    organizationId: proof.organization_id,
    entityType: "proof",
    entityId: proof.id,
    eventType: "proof.reviewed",
    boardId: proof.board_id,
    reason: input.notes.trim() || input.status,
    fromValue: { review_status: proof.review_status, geo_ok: proof.geo_ok },
    toValue: { review_status: input.status },
  });

  revalidatePath("/manage/proof-review");
  revalidatePath(`/manage/boards/${proof.board_id}`);
  return { ok: true };
}

export async function createProofShareLink(input: {
  boardId: string;
  days?: number;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const gate = await requireAction("boards.read");
  if (!gate.ok) return { ok: false, error: gate.error };
  const { supabase, userId } = gate;

  const { data: board } = await supabase
    .from("boards")
    .select("id, organization_id")
    .eq("id", input.boardId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!board) return { ok: false, error: "Board not found" };

  const days = Math.min(30, Math.max(1, input.days ?? 14));
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + days);

  const { data: link, error } = await supabase
    .from("proof_share_links")
    .insert({
      organization_id: board.organization_id,
      board_id: board.id,
      created_by: userId,
      expires_at: expires.toISOString(),
    })
    .select("token")
    .single();

  if (error || !link) return { ok: false, error: error?.message ?? "Create failed" };
  revalidatePath(`/manage/boards/${input.boardId}`);
  return { ok: true, token: link.token };
}
