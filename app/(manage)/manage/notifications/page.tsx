import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  markAllNotificationsReadForm,
  refreshAlertsForm,
} from "@/app/(manage)/manage/notifications/actions";
import { NotificationRow } from "@/components/manage/notification-row";
import {
  DigestPrefsForm,
  type DigestPrefs,
} from "@/components/manage/digest-prefs-form";
import type { AppNotification } from "@/lib/domain/notifications";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/auth/login?next=/manage/notifications");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .is("deactivated_at", null)
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) redirect("/manage");

  await supabase.rpc("refresh_compliance_alerts");

  const [{ data: rows }, { data: prefs }] = await Promise.all([
    supabase
      .from("notifications")
      .select(
        "id, kind, priority, title, body, href, entity_type, entity_id, read_at, created_at, escalated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("notification_user_prefs")
      .select(
        "in_app_enabled, email_digest_enabled, digest_frequency, compliance_alerts, agreement_alerts, incident_alerts, vacancy_alerts, quiet_hours_start, quiet_hours_end",
      )
      .eq("user_id", userId)
      .eq("organization_id", membership.organization_id)
      .maybeSingle(),
  ]);

  const notifications = (rows ?? []) as AppNotification[];
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Alerts</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            M07 · {unread} unread · Permit + agreement ending
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={refreshAlertsForm}>
            <button
              type="submit"
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            >
              Refresh alerts
            </button>
          </form>
          <form action={markAllNotificationsReadForm}>
            <button
              type="submit"
              className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={unread === 0}
            >
              Mark all read
            </button>
          </form>
        </div>
      </div>

      <DigestPrefsForm
        organizationId={membership.organization_id}
        initial={(prefs as DigestPrefs | null) ?? null}
      />

      {!notifications.length ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          No alerts yet. Add an expiring or expired mandatory clearance on a board, then refresh.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </ul>
      )}

      <p className="text-sm text-[var(--muted)]">
        Risk board:{" "}
        <Link href="/manage/compliance" className="text-[var(--accent)] hover:underline">
          Compliance
        </Link>
        {" · "}
        Org channels:{" "}
        <Link href="/manage/settings" className="text-[var(--accent)] hover:underline">
          Settings
        </Link>
      </p>
    </div>
  );
}
