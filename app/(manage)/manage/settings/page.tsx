import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotifySettingsForm } from "@/components/manage/notify-settings-form";
import { CompanyProfileForm } from "@/components/manage/company-profile-form";
import { OpsSettingsPanel } from "@/components/manage/ops-settings-panel";
import {
  TeamMembersPanel,
  type TeamMemberRow,
} from "@/components/manage/team-members-panel";
import { PermissionMatrixPanel } from "@/components/manage/permission-matrix-panel";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect("/auth/login?next=/manage/settings");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(*)")
    .eq("user_id", userId)
    .is("deactivated_at", null)
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) redirect("/manage");

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    legal_name: string | null;
    gstin: string | null;
    address_line: string | null;
    city: string | null;
    state: string | null;
    pin_code: string | null;
    brand_primary: string | null;
  };

  const isAdmin = membership.role === "company_admin";

  const { data: settings } = await supabase
    .from("organization_notify_settings")
    .select(
      "sms_enabled, whatsapp_enabled, email_enabled, dry_run, ops_mobile, ops_email, compliance_alerts_enabled, agreement_reminders_enabled, client_reminders_enabled",
    )
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  const { data: opsSettings } = await supabase
    .from("organization_ops_settings")
    .select("prelisting_window_days, alert_escalate_after_hours")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  const { data: clearanceTypes } = await supabase
    .from("organization_clearance_types")
    .select("id, code, label, is_mandatory_default, active")
    .eq("organization_id", membership.organization_id)
    .order("sort_order");

  const { data: recent } = await supabase
    .from("outbound_messages")
    .select(
      "id, channel, template_key, to_e164, status, provider, error, created_at, body",
    )
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(20);

  let teamRows: TeamMemberRow[] = [];
  let invites: { id: string; email: string; role: string; status: string; created_at: string }[] =
    [];

  if (isAdmin) {
    const { data: members } = await supabase
      .from("organization_members")
      .select("id, user_id, role, deactivated_at, scoped_cities, scoped_districts")
      .eq("organization_id", membership.organization_id)
      .order("created_at");

    const admin = createAdminClient();
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailById = new Map(
      (listed?.users ?? []).map((u) => [u.id, u.email ?? null] as const),
    );

    const profileIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = profileIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    teamRows = (members ?? []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      deactivated_at: m.deactivated_at,
      email: emailById.get(m.user_id) ?? null,
      full_name: nameById.get(m.user_id) ?? null,
      scoped_cities: m.scoped_cities ?? [],
      scoped_districts: m.scoped_districts ?? [],
    }));

    const { data: inviteRows } = await supabase
      .from("organization_invites")
      .select("id, email, role, status, created_at")
      .eq("organization_id", membership.organization_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    invites = inviteRows ?? [];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-[var(--ink)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {org.name} · Manage CRM · company, team, messaging
        </p>
      </div>

      {isAdmin ? (
        <>
          <CompanyProfileForm
            organizationId={membership.organization_id}
            initial={{
              name: org.name,
              legal_name: org.legal_name,
              gstin: org.gstin,
              address_line: org.address_line,
              city: org.city,
              state: org.state,
              pin_code: org.pin_code,
              brand_primary: org.brand_primary,
            }}
          />
          <TeamMembersPanel
            organizationId={membership.organization_id}
            members={teamRows}
            invites={invites}
          />
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
          Company profile and team invites are available to company admins.
        </p>
      )}

      {isAdmin ? (
        <OpsSettingsPanel
          organizationId={membership.organization_id}
          prelistingWindowDays={opsSettings?.prelisting_window_days ?? 30}
          alertEscalateAfterHours={opsSettings?.alert_escalate_after_hours ?? 24}
          clearanceTypes={clearanceTypes ?? []}
        />
      ) : null}

      {isAdmin ? <PermissionMatrixPanel /> : null}

      <div>
        <h2 className="mb-3 text-sm font-medium">Notifications & messaging</h2>
        <NotifySettingsForm
          organizationId={membership.organization_id}
          initial={settings}
          recent={recent ?? []}
        />
      </div>
    </div>
  );
}
