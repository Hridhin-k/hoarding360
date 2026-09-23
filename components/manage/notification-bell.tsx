import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function NotificationBell() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  const unread = count ?? 0;

  return (
    <Link
      href="/manage/notifications"
      className="relative rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--wash)] hover:text-[var(--ink)]"
      aria-label={unread ? `${unread} unread alerts` : "Alerts"}
    >
      Alerts
      {unread > 0 ? (
        <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--risk)] px-1.5 text-[10px] font-semibold leading-5 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
