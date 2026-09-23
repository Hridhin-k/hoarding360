import Link from "next/link";
import { requireManageSession } from "@/lib/supabase/session";
import {
  markAllNotificationsReadForm,
  refreshAlertsForm,
} from "@/app/(manage)/manage/notifications/actions";
import { NotificationRow } from "@/components/manage/notification-row";
import { FormSubmit, btnPrimary, btnSecondary } from "@/components/ui/pending-button";
import {
  DigestPrefsForm,
  type DigestPrefs,
} from "@/components/manage/digest-prefs-form";
import type { AppNotification } from "@/lib/domain/notifications";

export default async function NotificationsPage() {
  const { supabase, userId, orgId } = await requireManageSession("/manage/notifications");

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
      .eq("organization_id", orgId)
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
            M07 · {unread} unread · Permit + agreement ending · refreshes every 15 minutes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={refreshAlertsForm}>
            <FormSubmit pendingLabel="Refreshing…" className={btnSecondary}>
              Refresh alerts
            </FormSubmit>
          </form>
          <form action={markAllNotificationsReadForm}>
            <FormSubmit
              pendingLabel="Marking…"
              className={btnPrimary}
              disabled={unread === 0}
            >
              Mark all read
            </FormSubmit>
          </form>
        </div>
      </div>

      <DigestPrefsForm
        organizationId={orgId}
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
