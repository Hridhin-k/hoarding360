"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/domain/activity";

export async function activateAgreement(input: {
  agreementId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in" };

  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, error: "Reason required" };

  const { data: agr, error: fetchError } = await supabase
    .from("agreements")
    .select("id, organization_id, status, ref_code")
    .eq("id", input.agreementId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !agr) return { ok: false, error: fetchError?.message ?? "Not found" };
  if (agr.status !== "draft") {
    return { ok: false, error: "Only draft agreements can be activated" };
  }

  const { error } = await supabase
    .from("agreements")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.agreementId);

  if (error) return { ok: false, error: error.message };

  await supabase.rpc("sync_agreement_occupancy", { p_agreement_id: input.agreementId });

  await logActivity(supabase, {
    organizationId: agr.organization_id,
    entityType: "agreement",
    entityId: agr.id,
    eventType: "agreement.activated",
    reason,
    fromValue: { status: "draft" },
    toValue: { status: "active", ref_code: agr.ref_code },
  });

  revalidatePath("/manage/agreements");
  revalidatePath(`/manage/agreements/${input.agreementId}`);
  revalidatePath("/manage");
  return { ok: true };
}

export async function extendAgreement(input: {
  agreementId: string;
  endsOn: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in" };

  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, error: "Reason required for extend/revise" };
  if (!input.endsOn) return { ok: false, error: "New end date required" };

  const { data: agr, error: fetchError } = await supabase
    .from("agreements")
    .select("id, organization_id, status, starts_on, ends_on, ref_code")
    .eq("id", input.agreementId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !agr) return { ok: false, error: fetchError?.message ?? "Not found" };
  if (agr.status === "terminated" || agr.status === "cancelled") {
    return { ok: false, error: "Closed agreements cannot be extended" };
  }
  if (input.endsOn < agr.starts_on) {
    return { ok: false, error: "End date must be on or after start date" };
  }

  const { error } = await supabase
    .from("agreements")
    .update({
      ends_on: input.endsOn,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.agreementId);

  if (error) return { ok: false, error: error.message };

  await supabase
    .from("agreement_faces")
    .update({ ends_on: input.endsOn })
    .eq("agreement_id", input.agreementId)
    .is("deleted_at", null);

  await supabase.rpc("sync_agreement_occupancy", { p_agreement_id: input.agreementId });

  await logActivity(supabase, {
    organizationId: agr.organization_id,
    entityType: "agreement",
    entityId: agr.id,
    eventType: "agreement.extended",
    reason,
    fromValue: { ends_on: agr.ends_on },
    toValue: { ends_on: input.endsOn, ref_code: agr.ref_code },
  });

  revalidatePath("/manage/agreements");
  revalidatePath(`/manage/agreements/${input.agreementId}`);
  revalidatePath("/manage");
  return { ok: true };
}

export async function reviseAgreementAsNew(input: {
  agreementId: string;
  reason: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in" };

  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, error: "Reason required" };

  const { data: agr, error: fetchError } = await supabase
    .from("agreements")
    .select(
      "id, organization_id, client_id, ref_code, status, starts_on, ends_on, value_paise",
    )
    .eq("id", input.agreementId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !agr) return { ok: false, error: fetchError?.message ?? "Not found" };
  if (agr.status === "terminated" || agr.status === "cancelled") {
    return { ok: false, error: "Cannot revise a closed agreement" };
  }

  const { data: faces } = await supabase
    .from("agreement_faces")
    .select("face_id, starts_on, ends_on, rate_paise")
    .eq("agreement_id", input.agreementId)
    .is("deleted_at", null);

  const newRef = agr.ref_code
    ? `${agr.ref_code}-R${Date.now().toString().slice(-4)}`
    : `REV-${agr.id.slice(0, 6)}`;

  const { data: neu, error: insError } = await supabase
    .from("agreements")
    .insert({
      organization_id: agr.organization_id,
      client_id: agr.client_id,
      ref_code: newRef,
      starts_on: agr.starts_on,
      ends_on: agr.ends_on,
      value_paise: agr.value_paise,
      status: "draft",
    })
    .select("id")
    .single();

  if (insError || !neu) return { ok: false, error: insError?.message ?? "Create failed" };

  // Release old faces first so overlap trigger allows the revision draft
  await supabase
    .from("agreement_faces")
    .update({ deleted_at: new Date().toISOString() })
    .eq("agreement_id", agr.id)
    .is("deleted_at", null);

  await supabase
    .from("agreements")
    .update({
      status: "terminated",
      updated_at: new Date().toISOString(),
    })
    .eq("id", agr.id);

  await supabase.rpc("sync_agreement_occupancy", { p_agreement_id: agr.id });

  if (faces?.length) {
    const { error: faceError } = await supabase.from("agreement_faces").insert(
      faces.map((f) => ({
        organization_id: agr.organization_id,
        agreement_id: neu.id,
        face_id: f.face_id,
        starts_on: f.starts_on,
        ends_on: f.ends_on,
        rate_paise: f.rate_paise,
      })),
    );
    if (faceError) {
      return {
        ok: false,
        error: `Revision draft created (${neu.id}) and original terminated, but faces failed: ${faceError.message}`,
      };
    }
  }

  await supabase.rpc("sync_agreement_occupancy", { p_agreement_id: neu.id });

  await logActivity(supabase, {
    organizationId: agr.organization_id,
    entityType: "agreement",
    entityId: neu.id,
    eventType: "agreement.revised",
    reason,
    fromValue: { id: agr.id, ref_code: agr.ref_code },
    toValue: { id: neu.id, ref_code: newRef, status: "draft" },
  });

  revalidatePath("/manage/agreements");
  revalidatePath(`/manage/agreements/${agr.id}`);
  revalidatePath(`/manage/agreements/${neu.id}`);
  return { ok: true, id: neu.id };
}

export async function terminateAgreement(input: {
  agreementId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, error: "Not signed in" };

  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, error: "Termination reason is required" };

  const { data: agr, error: fetchError } = await supabase
    .from("agreements")
    .select("id, organization_id, status, ref_code")
    .eq("id", input.agreementId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !agr) return { ok: false, error: fetchError?.message ?? "Not found" };
  if (agr.status === "terminated" || agr.status === "cancelled") {
    return { ok: false, error: "Agreement already closed" };
  }

  const { error } = await supabase
    .from("agreements")
    .update({
      status: "terminated",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.agreementId);

  if (error) return { ok: false, error: error.message };

  // Soft-remove face lines so occupancy sync frees inventory
  await supabase
    .from("agreement_faces")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq("agreement_id", input.agreementId)
    .is("deleted_at", null);

  await supabase.rpc("sync_agreement_occupancy", { p_agreement_id: input.agreementId });

  await logActivity(supabase, {
    organizationId: agr.organization_id,
    entityType: "agreement",
    entityId: agr.id,
    eventType: "agreement.terminated",
    reason,
    fromValue: { status: agr.status },
    toValue: { status: "terminated", ref_code: agr.ref_code },
  });

  revalidatePath("/manage/agreements");
  revalidatePath(`/manage/agreements/${input.agreementId}`);
  revalidatePath("/manage");
  return { ok: true };
}
