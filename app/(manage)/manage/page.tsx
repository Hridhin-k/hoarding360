import Link from "next/link";
import { formatInrFromPaise, formatIstDate } from "@/lib/format";
import {
  dashboardGreeting,
  dashboardPersona,
  canSeeCosts,
} from "@/lib/domain/dashboard";
import { getManageSession } from "@/lib/supabase/session";

export default async function ManageDashboardPage() {
  const { supabase, role, orgId, orgName } = await getManageSession();
  const persona = dashboardPersona(role);
  const showRevenue = canSeeCosts(role) || persona === "sales" || persona === "admin_ops";
  const showFloorPipeline = canSeeCosts(role);
  const istToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
  const istIn90 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(Date.now() + 90 * 86400000),
  );

  const [
    boardsRes,
    expiredRes,
    expiringRes,
    missingRes,
    vacanciesRes,
    liveRes,
    lossRowsRes,
    revenueByClientRes,
    endingRes,
    alertsRes,
    unreadRes,
    revenueRpc,
    lossRpc,
  ] = await Promise.all([
    supabase.from("boards").select("id, lat, lng").is("deleted_at", null),
    supabase
      .from("compliance_records")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("is_mandatory", true)
      .eq("status", "expired"),
    supabase
      .from("compliance_records")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("is_mandatory", true)
      .eq("status", "expiring_soon"),
    supabase
      .from("compliance_records")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("is_mandatory", true)
      .eq("status", "missing"),
    supabase
      .from("upcoming_vacancies")
      .select(
        "face_id, board_id, board_code, board_name, face_label, available_from, card_rate_paise, occupancy_status, city",
      )
      .order("available_from", { ascending: true })
      .limit(persona === "sales" ? 10 : 5),
    supabase
      .from("live_agreements")
      .select("id, ref_code, starts_on, ends_on, value_paise, client_id, client_name, face_count")
      .order("ends_on", { ascending: true })
      .limit(8),
    supabase
      .from("vacancy_loss_faces")
      .select(
        "face_id, board_id, board_code, board_name, face_label, days_vacant, loss_paise, card_rate_paise, city",
      )
      .order("loss_paise", { ascending: false })
      .limit(5),
    showFloorPipeline
      ? supabase
          .from("revenue_by_client")
          .select("client_id, client_name, agreement_count, value_paise")
          .order("value_paise", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("agreements")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "active")
      .gte("ends_on", istToday)
      .lte("ends_on", istIn90),
    supabase
      .from("notifications")
      .select("id, title, kind, priority, href, read_at, created_at")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(persona === "compliance" ? 10 : 5),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
    orgId && showRevenue
      ? supabase.rpc("org_live_revenue_paise", { p_organization_id: orgId })
      : Promise.resolve({ data: 0 }),
    orgId
      ? supabase.rpc("org_vacancy_loss_paise", { p_organization_id: orgId })
      : Promise.resolve({ data: 0 }),
  ]);

  const boards = boardsRes.data;
  const boardIds = (boards ?? []).map((b) => b.id);
  const boardCount = boardIds.length;
  const withGps = (boards ?? []).filter((b) => b.lat != null && b.lng != null).length;

  let withPhoto = 0;
  let withRate = 0;
  let withPermit = 0;
  let withAgreement = 0;
  let occupiedFaces = 0;
  let vacantFaces = 0;
  let faceTotal = 0;

  if (boardIds.length) {
    const [photosRes, facesRes, permitsRes] = await Promise.all([
      supabase
        .from("board_photos")
        .select("board_id")
        .in("board_id", boardIds)
        .is("deleted_at", null),
      supabase
        .from("board_faces")
        .select("board_id, id, card_rate_paise, occupancy_status")
        .in("board_id", boardIds)
        .is("deleted_at", null),
      supabase
        .from("compliance_records")
        .select("board_id")
        .in("board_id", boardIds)
        .is("deleted_at", null),
    ]);

    withPhoto = new Set((photosRes.data ?? []).map((p) => p.board_id)).size;
    const faces = facesRes.data ?? [];
    withRate = new Set(faces.filter((f) => f.card_rate_paise != null).map((f) => f.board_id)).size;
    faceTotal = faces.length;
    for (const f of faces) {
      const s = f.occupancy_status as string;
      if (s === "occupied" || s === "booked_future" || s === "on_hold") occupiedFaces += 1;
      else if (s === "vacant" || s === "becoming_vacant") vacantFaces += 1;
    }
    withPermit = new Set((permitsRes.data ?? []).map((p) => p.board_id)).size;

    const faceIds = faces.map((f) => f.id);
    if (faceIds.length) {
      const { data: agrFaces } = await supabase
        .from("agreement_faces")
        .select("face_id, board_faces(board_id)")
        .in("face_id", faceIds)
        .is("deleted_at", null);
      const agreedBoards = new Set<string>();
      for (const af of agrFaces ?? []) {
        const bf = Array.isArray(af.board_faces) ? af.board_faces[0] : af.board_faces;
        if (bf?.board_id) agreedBoards.add(bf.board_id);
      }
      withAgreement = agreedBoards.size;
    }
  }

  const occupancyPct = faceTotal ? Math.round((occupiedFaces / faceTotal) * 100) : 0;
  const noPhotoCount = Math.max(0, boardCount - withPhoto);
  const noRateCount = Math.max(0, boardCount - withRate);
  const pct = (n: number) => (boardCount ? Math.round((n / boardCount) * 100) : 0);

  const expiredCount = expiredRes.count;
  const expiringCount = expiringRes.count;
  const missingCount = missingRes.count;
  const vacancies = vacanciesRes.data;
  const vacancyPipelinePaise = (vacancies ?? []).reduce(
    (sum, v) => sum + (v.card_rate_paise ?? 0),
    0,
  );
  const liveAgreements = liveRes.data;
  const liveRevenuePaise =
    typeof revenueRpc.data === "number" ? revenueRpc.data : Number(revenueRpc.data ?? 0);
  const vacancyLossPaise =
    typeof lossRpc.data === "number" ? lossRpc.data : Number(lossRpc.data ?? 0);
  const vacancyLossRows = lossRowsRes.data;
  const revenueByClient = revenueByClientRes.data;
  const endingSoonCount = endingRes.count;
  const recentAlerts = alertsRes.data;
  const unreadAlertCount = unreadRes.count;

  const riskTotal = (expiredCount ?? 0) + (expiringCount ?? 0) + (missingCount ?? 0);

  const tracker = [
    { label: "GPS", value: pct(withGps) },
    { label: "Photo", value: pct(withPhoto) },
    { label: "Rate", value: pct(withRate) },
    { label: "Permit", value: pct(withPermit) },
    { label: "Agreement", value: pct(withAgreement) },
  ];

  const showOnboarding = persona === "admin_ops" || persona === "generic";
  const showRisk =
    persona === "admin_ops" ||
    persona === "compliance" ||
    persona === "generic" ||
    persona === "field";
  const showVacancies =
    persona === "admin_ops" ||
    persona === "sales" ||
    persona === "finance" ||
    persona === "generic";
  const showLiveCampaigns =
    persona === "admin_ops" ||
    persona === "sales" ||
    persona === "finance" ||
    persona === "generic";
  const showFieldCta = persona === "field" || persona === "admin_ops";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          {dashboardGreeting(persona)}
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          {orgName}
          {role ? ` · ${String(role).replace(/_/g, " ")}` : ""} · M09
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Structures</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-3xl">{boardCount}</p>
        </div>

        {showRevenue ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Live revenue
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">
              {formatInrFromPaise(liveRevenuePaise)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {liveAgreements?.length ?? 0} live agreements
              {!showFloorPipeline ? " · card rates only" : ""}
            </p>
          </div>
        ) : (
          <Link
            href="/field"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--wash)]"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Field</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">Open PWA</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Proof · incidents · queue</p>
          </Link>
        )}

        {showRisk ? (
          <Link
            href="/manage/compliance"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--wash)]"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Risk strip</p>
            <p
              className={`mt-2 font-[family-name:var(--font-display)] text-3xl ${
                riskTotal > 0 ? "text-[var(--risk)]" : "text-[var(--ok)]"
              }`}
            >
              {riskTotal}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {expiredCount ?? 0} expired · {expiringCount ?? 0} expiring · {missingCount ?? 0}{" "}
              missing
            </p>
          </Link>
        ) : (
          <Link
            href="/manage/agreements/new"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--wash)]"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Book inventory</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">New agreement</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Overlap blocked automatically</p>
          </Link>
        )}

        <Link
          href="/manage/notifications"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--wash)]"
        >
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Unread alerts</p>
          <p
            className={`mt-2 font-[family-name:var(--font-display)] text-3xl ${
              (unreadAlertCount ?? 0) > 0 ? "text-[var(--risk)]" : ""
            }`}
          >
            {unreadAlertCount ?? 0}
          </p>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Occupancy</p>
          <p className="mt-2 text-2xl font-medium">{occupancyPct}%</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {occupiedFaces} sold · {vacantFaces} free · {faceTotal} faces
          </p>
        </div>
        <Link
          href="/manage/boards?compliance=missing"
          className="rounded-lg border border-[var(--border)] bg-white p-4 hover:bg-[var(--wash)]"
        >
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">No photo</p>
          <p
            className={`mt-2 text-2xl font-medium ${
              noPhotoCount > 0 ? "text-[var(--google-yellow)]" : "text-[var(--google-green)]"
            }`}
          >
            {noPhotoCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Boards without gallery</p>
        </Link>
        <Link
          href="/manage/boards"
          className="rounded-lg border border-[var(--border)] bg-white p-4 hover:bg-[var(--wash)]"
        >
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">No card rate</p>
          <p
            className={`mt-2 text-2xl font-medium ${
              noRateCount > 0 ? "text-[var(--google-yellow)]" : "text-[var(--google-green)]"
            }`}
          >
            {noRateCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Boards missing face rates</p>
        </Link>
        <Link
          href="/manage/activity"
          className="rounded-lg border border-[var(--border)] bg-white p-4 hover:bg-[var(--wash)]"
        >
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Audit</p>
          <p className="mt-2 text-2xl font-medium text-[var(--primary)]">Activity</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Org-wide log · CSV export</p>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/manage/availability"
          className="rounded-lg border border-[var(--border)] bg-white p-4 hover:bg-[var(--wash)]"
        >
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
            Vacancy loss (est.)
          </p>
          <p className="mt-2 text-2xl font-medium text-[var(--google-red)]">
            {formatInrFromPaise(vacancyLossPaise)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Days empty × card rate / 30 · Media Owners promise
          </p>
        </Link>
        <Link
          href="/manage/agreements"
          className="rounded-lg border border-[var(--border)] bg-white p-4 hover:bg-[var(--wash)]"
        >
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
            Ending in 90 days
          </p>
          <p className="mt-2 text-2xl font-medium">{endingSoonCount ?? 0}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Active contracts nearing end</p>
        </Link>
        <Link
          href="/manage/availability"
          className="rounded-lg border border-[var(--border)] bg-white p-4 hover:bg-[var(--wash)]"
        >
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Find free faces</p>
          <p className="mt-2 text-2xl font-medium text-[var(--primary)]">Availability</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Date-range search for sales</p>
        </Link>
      </div>

      {vacancyLossRows?.length ? (
        <section className="space-y-3">
          <h2 className="font-medium">Worst vacant faces</h2>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            {vacancyLossRows.map((v) => (
              <li
                key={v.face_id}
                className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <Link
                    href={`/manage/boards/${v.board_id}?tab=occupancy`}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    {v.board_code} · Face {v.face_label}
                  </Link>
                  <p className="text-[var(--muted)]">
                    {v.days_vacant} days vacant
                    {v.city ? ` · ${v.city}` : ""}
                  </p>
                </div>
                <p className="font-medium text-[var(--google-red)]">
                  {formatInrFromPaise(v.loss_paise)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showFloorPipeline && revenueByClient?.length ? (
        <section className="space-y-3">
          <h2 className="font-medium">Revenue by client</h2>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            {revenueByClient.map((r) => (
              <li
                key={r.client_id}
                className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <Link
                    href={`/manage/clients/${r.client_id}`}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    {r.client_name}
                  </Link>
                  <p className="text-[var(--muted)]">{r.agreement_count} agreement(s)</p>
                </div>
                <p className="font-medium">{formatInrFromPaise(r.value_paise)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showFieldCta ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-sm text-[var(--muted)]">
            Field PWA · QR proof ≤150 m · offline queue
          </p>
          <Link
            href="/field"
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Open Field
          </Link>
        </section>
      ) : null}

      {recentAlerts?.length && (showRisk || persona === "sales") ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Needs attention</h2>
            <Link href="/manage/notifications" className="text-sm text-[var(--accent)]">
              All alerts
            </Link>
          </div>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            {recentAlerts.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <Link
                  href={a.href || "/manage/notifications"}
                  className="font-medium text-[var(--accent)] hover:underline"
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showLiveCampaigns ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">Live campaigns</h2>
              <p className="text-sm text-[var(--muted)]">
                Active agreements in date range (V1 — full campaigns in V2.1)
              </p>
            </div>
            <Link href="/manage/agreements/new" className="text-sm text-[var(--accent)]">
              New agreement
            </Link>
          </div>
          {!liveAgreements?.length ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">
              No live agreements today. Book a face to see contracted revenue here.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {liveAgreements.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/manage/clients/${a.client_id}`}
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {a.client_name}
                    </Link>
                    <p className="text-[var(--muted)]">
                      {a.ref_code || a.id.slice(0, 8)} · {a.face_count} face
                      {a.face_count === 1 ? "" : "s"} · {formatIstDate(a.starts_on)} →{" "}
                      {formatIstDate(a.ends_on)}
                    </p>
                  </div>
                  <p className="font-medium">{formatInrFromPaise(a.value_paise)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showOnboarding ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">Onboarding tracker</h2>
              <p className="text-sm text-[var(--muted)]">
                % of boards with each data field complete
              </p>
            </div>
            <Link
              href="/manage/import"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Bulk import CSV
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            {tracker.map((t) => (
              <div key={t.label}>
                <div className="flex justify-between text-xs text-[var(--muted)]">
                  <span>{t.label}</span>
                  <span>{t.value}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--wash)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${t.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showVacancies ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-medium">Upcoming vacancies</h2>
              <p className="text-sm text-[var(--muted)]">
                Card-rate pipeline: {formatInrFromPaise(vacancyPipelinePaise)}
              </p>
            </div>
            <Link href="/manage/vacancies" className="text-sm text-[var(--accent)]">
              All vacancies
            </Link>
          </div>
          {!vacancies?.length ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">
              No upcoming free faces in the next 90 days.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {vacancies.map((v) => (
                <li
                  key={v.face_id}
                  className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/manage/boards/${v.board_id}?tab=occupancy`}
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {v.board_code} · Face {v.face_label}
                    </Link>
                    <p className="text-[var(--muted)]">
                      {v.occupancy_status} · Available from {formatIstDate(v.available_from)}
                      {v.city ? ` · ${v.city}` : ""}
                    </p>
                  </div>
                  <p>{formatInrFromPaise(v.card_rate_paise)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
