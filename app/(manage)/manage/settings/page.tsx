import { createAdminClient } from "@/lib/supabase/admin";
import { requireManageSession } from "@/lib/supabase/session";
import { NotifySettingsForm } from "@/components/manage/notify-settings-form";
import { CompanyProfileForm } from "@/components/manage/company-profile-form";
import { OpsSettingsPanel } from "@/components/manage/ops-settings-panel";
import {
  TeamMembersPanel,
  type TeamMemberRow,
} from "@/components/manage/team-members-panel";
import { PermissionMatrixPanel } from "@/components/manage/permission-matrix-panel";

export default async function SettingsPage() {
  const { supabase, orgId, role } = await requireManageSession("/manage/settings");
  const isAdmin = role === "company_admin";

  const [orgRes, settingsRes, opsRes, typesRes, recentRes, membersRes, invitesRes] =
    await Promise.all([
      supabase
        .from("organizations")
        .select(
          "id, name, legal_name, gstin, address_line, city, state, pin_code, brand_primary",
        )
        .eq("id", orgId)
        .maybeSingle(),
      supabase
        .from("organization_notify_settings")
        .select(
          "sms_enabled, whatsapp_enabled, email_enabled, dry_run, ops_mobile, ops_email, compliance_alerts_enabled, agreement_reminders_enabled, client_reminders_enabled",
        )
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase
        .from("organization_ops_settings")
        .select("prelisting_window_days, alert_escalate_after_hours")
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase
        .from("organization_clearance_types")
        .select("id, code, label, is_mandatory_default, active")
        .eq("organization_id", orgId)
        .order("sort_order"),
      supabase
        .from("outbound_messages")
        .select("id, channel, template_key, to_e164, status, provider, error, created_at, body")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20),
      isAdmin
        ? supabase
            .from("organization_members")
            .select("id, user_id, role, deactivated_at, scoped_cities, scoped_districts")
            .eq("organization_id", orgId)
            .order("created_at")
        : Promise.resolve({ data: [] as never[] }),
      isAdmin
        ? supabase
            .from("organization_invites")
            .select("id, email, role, status, created_at")
            .eq("organization_id", orgId)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
    ]);

  const org = orgRes.data ?? {
    id: orgId,
    name: "Your company",
    legal_name: null,
    gstin: null,
    address_line: null,
    city: null,
    state: null,
    pin_code: null,
    brand_primary: null,
  };
  const settings = settingsRes.data;
  const opsSettings = opsRes.data;
  const clearanceTypes = typesRes.data;
  const recent = recentRes.data;

  let teamRows: TeamMemberRow[] = [];
  const invites = invitesRes.data ?? [];

  if (isAdmin) {
    const members = membersRes.data ?? [];
    const profileIds = members.map((m) => m.user_id);
    const admin = createAdminClient();
    const [{ data: listed }, { data: profiles }] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      profileIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", profileIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    ]);
    const emailById = new Map(
      (listed?.users ?? []).map((u) => [u.id, u.email ?? null] as const),
    );
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    teamRows = members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      deactivated_at: m.deactivated_at,
      email: emailById.get(m.user_id) ?? null,
      full_name: nameById.get(m.user_id) ?? null,
      scoped_cities: m.scoped_cities ?? [],
      scoped_districts: m.scoped_districts ?? [],
    }));
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
            organizationId={orgId}
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
            organizationId={orgId}
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
          organizationId={orgId}
          prelistingWindowDays={opsSettings?.prelisting_window_days ?? 30}
          alertEscalateAfterHours={opsSettings?.alert_escalate_after_hours ?? 24}
          clearanceTypes={clearanceTypes ?? []}
        />
      ) : null}

      {isAdmin ? <PermissionMatrixPanel /> : null}

      <div>
        <h2 className="mb-3 text-sm font-medium">Notifications & messaging</h2>
        <NotifySettingsForm
          organizationId={orgId}
          initial={settings}
          recent={recent ?? []}
        />
      </div>
    </div>
  );
}
