import { redirect } from "next/navigation";
import { ManageSidebar } from "@/components/shell/manage-sidebar";
import { NotificationBell } from "@/components/manage/notification-bell";
import { ManageGlobalSearch } from "@/components/manage/manage-global-search";
import { ManageQuickAdd } from "@/components/manage/manage-quick-add";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/domain/status";

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/auth/login?next=/manage");
  }

  const userId = data.claims.sub as string;
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .is("deactivated_at", null)
    .limit(1)
    .maybeSingle();

  const role = (membership?.role as OrgRole | undefined) ?? null;

  if (role === "field_technician") {
    redirect("/field");
  }

  return (
    <div className="flex min-h-screen">
      <ManageSidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col bg-[var(--background)]">
        <header className="flex h-14 items-center gap-4 border-b border-[var(--border)] bg-white px-4 sm:px-6">
          <ManageGlobalSearch />
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <ManageQuickAdd />
            <NotificationBell />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}
