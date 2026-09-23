import Link from "next/link";
import { BoardForm } from "@/components/manage/board-form";
import { requireManageSession } from "@/lib/supabase/session";

export default async function NewBoardPage() {
  const { orgId } = await requireManageSession("/manage/boards/new");

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
      <BoardForm organizationId={orgId} mode="create" />
    </div>
  );
}
