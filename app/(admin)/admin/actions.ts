"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireStaff() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false as const, error: "Not signed in", supabase, userId: null };

  const { data: staff } = await supabase
    .from("platform_staff")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!staff) return { ok: false as const, error: "Not platform staff", supabase, userId };

  return { ok: true as const, supabase, userId, role: staff.role };
}

export async function createOrganizationForm(formData: FormData): Promise<void> {
  const gate = await requireStaff();
  if (!gate.ok) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await gate.supabase.rpc("admin_create_organization", {
    p_name: name,
    p_feature_flags: {
      marketplace: false,
      import: true,
      field_pwa: false,
    },
  });

  revalidatePath("/admin");
}

export async function setSuspendedForm(formData: FormData): Promise<void> {
  const gate = await requireStaff();
  if (!gate.ok) return;

  const id = String(formData.get("organization_id") ?? "");
  const suspend = String(formData.get("suspend") ?? "") === "true";
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!id) return;

  await gate.supabase.rpc("admin_set_organization_suspended", {
    p_organization_id: id,
    p_suspend: suspend,
    p_reason: reason,
  });

  revalidatePath("/admin");
}

export async function setPlanForm(formData: FormData): Promise<void> {
  const gate = await requireStaff();
  if (!gate.ok) return;

  const id = String(formData.get("organization_id") ?? "");
  const plan = String(formData.get("plan") ?? "").trim();
  if (!id || !plan) return;

  await gate.supabase.rpc("admin_set_organization_plan", {
    p_organization_id: id,
    p_plan: plan,
  });

  revalidatePath("/admin");
}

export async function setFeatureFlagsForm(formData: FormData): Promise<void> {
  const gate = await requireStaff();
  if (!gate.ok) return;

  const id = String(formData.get("organization_id") ?? "");
  if (!id) return;

  const flags = {
    marketplace: formData.get("marketplace") === "on",
    import: formData.get("import") === "on",
    field_pwa: formData.get("field_pwa") === "on",
  };

  await gate.supabase.rpc("admin_set_feature_flags", {
    p_organization_id: id,
    p_feature_flags: flags,
  });

  revalidatePath("/admin");
}

export async function startImpersonationAuditForm(formData: FormData): Promise<void> {
  const gate = await requireStaff();
  if (!gate.ok || !gate.userId) return;

  const organizationId = String(formData.get("organization_id") ?? "") || null;
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return;

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await gate.supabase.from("impersonation_audits").insert({
    staff_user_id: gate.userId,
    organization_id: organizationId,
    reason,
    expires_at: expiresAt,
    notes: "Time-boxed support session recorded. Session switch is not enabled.",
  });

  revalidatePath("/admin");
}
