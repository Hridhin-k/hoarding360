"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ROLES, type OrgRole } from "@/lib/domain/status";
import { logActivity } from "@/lib/domain/activity";

async function requireCompanyAdmin(organizationId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false as const, error: "Not signed in", supabase, userId: null };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .is("deactivated_at", null)
    .maybeSingle();

  if (membership?.role !== "company_admin") {
    return { ok: false as const, error: "Only company admin can manage this", supabase, userId };
  }
  return { ok: true as const, supabase, userId };
}

export type CompanyProfileInput = {
  organizationId: string;
  name: string;
  legalName: string;
  gstin: string;
  addressLine: string;
  city: string;
  state: string;
  pinCode: string;
  brandPrimary: string;
};

export async function saveCompanyProfile(
  input: CompanyProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireCompanyAdmin(input.organizationId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const { error } = await gate.supabase
    .from("organizations")
    .update({
      name: input.name.trim(),
      legal_name: input.legalName.trim() || null,
      gstin: input.gstin.trim() || null,
      address_line: input.addressLine.trim() || null,
      city: input.city.trim() || null,
      state: input.state.trim() || null,
      pin_code: input.pinCode.trim() || null,
      brand_primary: input.brandPrimary.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.organizationId);

  if (error) return { ok: false, error: error.message };

  await logActivity(gate.supabase, {
    organizationId: input.organizationId,
    entityType: "organization",
    entityId: input.organizationId,
    eventType: "organization.updated",
    toValue: { name: input.name.trim() },
  });

  revalidatePath("/manage/settings");
  revalidatePath("/manage");
  return { ok: true };
}

export async function inviteTeamMember(input: {
  organizationId: string;
  email: string;
  role: OrgRole;
  fullName?: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const gate = await requireCompanyAdmin(input.organizationId);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!gate.userId) return { ok: false, error: "Not signed in" };

  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, error: "Valid email required" };
  if (!ORG_ROLES.includes(input.role)) return { ok: false, error: "Invalid role" };

  const admin = createAdminClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: input.fullName?.trim() || email.split("@")[0],
      organization_id: input.organizationId,
      role: input.role,
    },
    redirectTo: `${siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`}/auth/callback?next=/manage`,
  });

  if (inviteError) {
    // User may already exist — look them up and attach membership
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!existing) {
      return { ok: false, error: inviteError.message };
    }

    const { error: memError } = await admin.from("organization_members").upsert(
      {
        organization_id: input.organizationId,
        user_id: existing.id,
        role: input.role,
        invited_by: gate.userId,
        deactivated_at: null,
      },
      { onConflict: "organization_id,user_id" },
    );
    if (memError) return { ok: false, error: memError.message };

    await gate.supabase.from("organization_invites").upsert(
      {
        organization_id: input.organizationId,
        email,
        role: input.role,
        invited_by: gate.userId,
        status: "accepted",
        auth_user_id: existing.id,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,email" },
    );

    revalidatePath("/manage/settings");
    return { ok: true, message: "Existing user added to your organisation." };
  }

  const userId = invited.user?.id;
  if (userId) {
    const { error: memError } = await admin.from("organization_members").upsert(
      {
        organization_id: input.organizationId,
        user_id: userId,
        role: input.role,
        invited_by: gate.userId,
        deactivated_at: null,
      },
      { onConflict: "organization_id,user_id" },
    );
    if (memError) return { ok: false, error: memError.message };
  }

  await gate.supabase.from("organization_invites").upsert(
    {
      organization_id: input.organizationId,
      email,
      role: input.role,
      invited_by: gate.userId,
      status: "pending",
      auth_user_id: userId ?? null,
    },
    { onConflict: "organization_id,email" },
  );

  await logActivity(gate.supabase, {
    organizationId: input.organizationId,
    entityType: "organization",
    entityId: input.organizationId,
    eventType: "member.invited",
    toValue: { email, role: input.role },
  });

  revalidatePath("/manage/settings");
  return { ok: true, message: "Invite sent. They will set a password from the email link." };
}

export async function updateMemberRole(input: {
  organizationId: string;
  memberId: string;
  role: OrgRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireCompanyAdmin(input.organizationId);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!ORG_ROLES.includes(input.role)) return { ok: false, error: "Invalid role" };

  const { error } = await gate.supabase
    .from("organization_members")
    .update({ role: input.role, updated_at: new Date().toISOString() })
    .eq("id", input.memberId)
    .eq("organization_id", input.organizationId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/manage/settings");
  return { ok: true };
}

export async function setMemberActive(input: {
  organizationId: string;
  memberId: string;
  active: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireCompanyAdmin(input.organizationId);
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!input.active && gate.userId) {
    const { data: target } = await gate.supabase
      .from("organization_members")
      .select("user_id")
      .eq("id", input.memberId)
      .maybeSingle();
    if (target?.user_id === gate.userId) {
      return { ok: false, error: "You cannot deactivate yourself" };
    }
  }

  const { error } = await gate.supabase
    .from("organization_members")
    .update({
      deactivated_at: input.active ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.memberId)
    .eq("organization_id", input.organizationId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/manage/settings");
  return { ok: true };
}
