import { createClient } from "@/lib/supabase/server";
import { can, type ModuleAction } from "@/lib/domain/permissions";
import type { OrgRole } from "@/lib/domain/status";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthzOk = {
  ok: true;
  supabase: SupabaseClient;
  userId: string;
  organizationId: string;
  role: OrgRole;
};

export type AuthzFail = { ok: false; error: string };

/** Gate Manage server actions with M01 module.action matrix. */
export async function requireAction(
  action: ModuleAction,
): Promise<AuthzOk | AuthzFail> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, error: "Not signed in" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role, scoped_cities, scoped_districts")
    .eq("user_id", userId)
    .is("deactivated_at", null)
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) {
    return { ok: false, error: "No organisation membership" };
  }

  const role = membership.role as OrgRole;
  if (!can(role, action)) {
    return { ok: false, error: `Missing permission: ${action}` };
  }

  return {
    ok: true,
    supabase,
    userId,
    organizationId: membership.organization_id,
    role,
  };
}

export async function memberGeoScope(userId: string): Promise<{
  cities: string[];
  districts: string[];
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("scoped_cities, scoped_districts, role")
    .eq("user_id", userId)
    .is("deactivated_at", null)
    .limit(1)
    .maybeSingle();

  if (!data || data.role !== "field_supervisor") return null;
  return {
    cities: data.scoped_cities ?? [],
    districts: data.scoped_districts ?? [],
  };
}
