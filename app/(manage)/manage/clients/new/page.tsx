import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientForm } from "@/components/manage/client-form";
import { createClient } from "@/lib/supabase/server";

async function requireOrgId() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId ?? "")
    .is("deactivated_at", null)
    .limit(1)
    .maybeSingle();
  if (!membership?.organization_id) redirect("/manage");
  return { supabase, organizationId: membership.organization_id };
}

export default async function NewClientPage() {
  const { organizationId } = await requireOrgId();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/manage/clients" className="text-sm text-[var(--muted)]">
          ← Clients
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Add client</h1>
      </div>
      <ClientForm organizationId={organizationId} />
    </div>
  );
}
