import Link from "next/link";
import { ClientForm } from "@/components/manage/client-form";
import { requireManageSession } from "@/lib/supabase/session";

export default async function NewClientPage() {
  const { orgId: organizationId } = await requireManageSession("/manage/clients/new");

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
