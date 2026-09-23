import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createOrganizationForm,
  setFeatureFlagsForm,
  setPlanForm,
  setSuspendedForm,
  startImpersonationAuditForm,
} from "./actions";

const PLANS = ["listing", "starter", "professional", "enterprise", "white_label"] as const;

type OrgRow = {
  id: string;
  name: string;
  plan: string;
  feature_flags: Record<string, boolean> | null;
  suspended_at: string | null;
  created_at: string;
};

type Health = {
  organizations?: number;
  suspended?: number;
  boards?: number;
  faces?: number;
  agreements_live?: number;
  expired_mandatory?: number;
  open_alerts?: number;
  storage_objects?: number;
};

type AuditRow = {
  id: string;
  organization_id: string | null;
  reason: string;
  started_at: string;
  expires_at: string;
  notes: string | null;
};

function flagOn(flags: OrgRow["feature_flags"], key: string) {
  return Boolean(flags && flags[key]);
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminHomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/login?next=/admin");

  const userId = data.claims.sub as string;
  const { data: staff } = await supabase
    .from("platform_staff")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!staff) {
    return (
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Super Admin</h1>
        <p className="mt-2 text-[var(--muted)]">M33 · PLAT-01 to PLAT-03 · V1.0</p>
        <p className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
          Your user is not in <code>platform_staff</code>. A platform operator must add your user
          id before tenant tools unlock.
        </p>
      </div>
    );
  }

  const { data: healthRaw } = await supabase.rpc("platform_health");
  const health = (healthRaw ?? {}) as Health;

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, plan, feature_flags, suspended_at, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: audits } = await supabase
    .from("impersonation_audits")
    .select("id, organization_id, reason, started_at, expires_at, notes")
    .order("started_at", { ascending: false })
    .limit(8);

  const tiles: { label: string; value: number }[] = [
    { label: "Organizations", value: health.organizations ?? 0 },
    { label: "Suspended", value: health.suspended ?? 0 },
    { label: "Boards", value: health.boards ?? 0 },
    { label: "Faces", value: health.faces ?? 0 },
    { label: "Live agreements", value: health.agreements_live ?? 0 },
    { label: "Expired permits", value: health.expired_mandatory ?? 0 },
    { label: "Open alerts", value: health.open_alerts ?? 0 },
    { label: "Stored files", value: health.storage_objects ?? 0 },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Super Admin</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Signed in as platform {staff.role} · M33 V1.0
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-medium">Platform health</h2>
          <p className="text-sm text-[var(--muted)]">
            Job queues and event-bus lag are not on this stack. Alerts, permits, and storage are.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.label}</p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">{t.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Create organization</h2>
        <form action={createOrganizationForm} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">Company name</span>
            <input
              name="name"
              required
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Create
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Tenants</h2>
        {!orgs?.length ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">
            No organizations yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {(orgs as OrgRow[]).map((org) => (
              <li
                key={org.id}
                className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium">{org.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {org.plan} · created {formatWhen(org.created_at)}
                      {org.suspended_at ? " · suspended" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <form action={setPlanForm} className="flex items-end gap-2 text-sm">
                    <input type="hidden" name="organization_id" value={org.id} />
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">Plan</span>
                      <select
                        name="plan"
                        defaultValue={org.plan}
                        className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
                      >
                        {PLANS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5">
                      Save plan
                    </button>
                  </form>

                  <form action={setFeatureFlagsForm} className="flex flex-wrap items-center gap-3 text-sm">
                    <input type="hidden" name="organization_id" value={org.id} />
                    <label className="flex items-center gap-1">
                      <input type="checkbox" name="import" defaultChecked={flagOn(org.feature_flags, "import")} />
                      Import
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        name="marketplace"
                        defaultChecked={flagOn(org.feature_flags, "marketplace")}
                      />
                      Marketplace
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        name="field_pwa"
                        defaultChecked={flagOn(org.feature_flags, "field_pwa")}
                      />
                      Field
                    </label>
                    <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5">
                      Save flags
                    </button>
                  </form>

                  <form action={setSuspendedForm} className="flex flex-wrap items-end gap-2 text-sm">
                    <input type="hidden" name="organization_id" value={org.id} />
                    <input
                      type="hidden"
                      name="suspend"
                      value={org.suspended_at ? "false" : "true"}
                    />
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">Reason</span>
                      <input
                        name="reason"
                        className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-md border border-[var(--border)] px-3 py-1.5"
                    >
                      {org.suspended_at ? "Unsuspend" : "Suspend"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-medium">Support session audit</h2>
          <p className="text-sm text-[var(--muted)]">
            Each session needs a reason and expires in one hour. The record is written to the audit
            log. Signing in as the tenant is not switched on.
          </p>
        </div>
        <form action={startImpersonationAuditForm} className="flex flex-wrap items-end gap-3 text-sm">
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">Organization</span>
            <select
              name="organization_id"
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
            >
              <option value="">—</option>
              {(orgs as OrgRow[] | null)?.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">Reason</span>
            <input
              name="reason"
              required
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-white"
          >
            Record session
          </button>
        </form>
        {audits?.length ? (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm">
            {(audits as AuditRow[]).map((a) => (
              <li key={a.id} className="px-4 py-3">
                <p className="font-medium">{a.reason}</p>
                <p className="text-xs text-[var(--muted)]">
                  Started {formatWhen(a.started_at)} · expires {formatWhen(a.expires_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
