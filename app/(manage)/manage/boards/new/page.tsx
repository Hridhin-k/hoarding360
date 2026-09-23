import Link from "next/link";
import { redirect } from "next/navigation";
import { BoardForm } from "@/components/manage/board-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewBoardPage() {
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

  if (!membership?.organization_id) {
    redirect("/manage");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/manage/boards" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          ← Boards
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Add board</h1>
        <p className="text-sm text-[var(--muted)]">
          M02 · GPS, address, faces. Upload photos on Board 360 after save.
        </p>
      </div>
      <BoardForm organizationId={membership.organization_id} mode="create" />
    </div>
  );
}
