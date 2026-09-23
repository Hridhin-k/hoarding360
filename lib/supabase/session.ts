import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/domain/status";

function orgFromMembership(row: {
  organizations: { id: string; name: string } | { id: string; name: string }[] | null;
}): { id: string; name: string } | null {
  const org = row.organizations;
  if (!org) return null;
  if (Array.isArray(org)) return org[0] ?? null;
  if (typeof org === "object" && "id" in org) return org;
  return null;
}

/** One auth + membership read per request, shared by the Manage layout and pages. */
export const getManageSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;

  if (!userId) {
    return {
      supabase,
      userId: null as string | null,
      role: null as OrgRole | null,
      orgId: null as string | null,
      orgName: "Your company",
      scopedCities: [] as string[],
      scopedDistricts: [] as string[],
    };
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, scoped_cities, scoped_districts, organizations(id, name)")
    .eq("user_id", userId)
    .is("deactivated_at", null);

  const first = memberships?.[0];
  const org = first ? orgFromMembership(first) : null;

  return {
    supabase,
    userId,
    role: (first?.role as OrgRole | undefined) ?? null,
    orgId: org?.id ?? null,
    orgName: org?.name ?? "Your company",
    scopedCities: first?.scoped_cities ?? [],
    scopedDistricts: first?.scoped_districts ?? [],
  };
});

/** Layout already loaded this. Pages reuse it instead of signing in again. */
export async function requireManageSession(nextPath = "/manage") {
  const session = await getManageSession();
  if (!session.userId) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  if (!session.orgId) redirect("/manage");
  return {
    ...session,
    userId: session.userId,
    orgId: session.orgId,
  };
}
