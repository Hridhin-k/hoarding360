import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { COMPLIANCE_BADGE } from "@/lib/domain/compliance";
import type { ComplianceStatus } from "@/lib/domain/status";
import { formatIstDate } from "@/lib/format";

export default async function ComplianceRiskPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "queue" ? "queue" : "risk";

  const supabase = await createClient();

  await supabase.rpc("refresh_compliance_alerts");

  const { data: records, error } = await supabase
    .from("compliance_records")
    .select(
      "id, board_id, clearance_type, governing_body, expiry_date, status, is_mandatory, under_renewal, boards(board_code, name, city)",
    )
    .is("deleted_at", null)
    .eq("is_mandatory", true)
    .in("status", ["expired", "expiring_soon", "missing", "under_renewal"])
    .order("expiry_date", { ascending: true, nullsFirst: true });

  const { data: overrideBoards } = await supabase
    .from("boards")
    .select(
      "id, board_code, name, city, compliance_publish_override_until, compliance_publish_override_reason",
    )
    .is("deleted_at", null)
    .not("compliance_publish_override_until", "is", null)
    .gte(
      "compliance_publish_override_until",
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()),
    );

  const groups: Record<string, NonNullable<typeof records>> = {
    expired: [],
    expiring_soon: [],
    missing: [],
    under_renewal: [],
  };

  for (const r of records ?? []) {
    const key = r.status as string;
    if (key in groups) {
      groups[key] = [...groups[key], r];
    }
  }

  const queueRows = [
    ...groups.under_renewal,
    ...groups.expired,
    ...groups.expiring_soon,
  ];

  const counts = {
    expired: groups.expired.length,
    expiring_soon: groups.expiring_soon.length,
    missing: groups.missing.length,
    under_renewal: groups.under_renewal.length,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Compliance</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            M04 · Mandatory clearances · Status computed from expiry (IST)
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/manage/compliance"
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === "risk"
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border)] bg-white"
            }`}
          >
            Risk
          </Link>
          <Link
            href="/manage/compliance?view=queue"
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === "queue"
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border)] bg-white"
            }`}
          >
            Renewal queue
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat href="#expired" label="Expired" value={counts.expired} tone="risk" />
        <Stat
          href="#expiring"
          label="Expiring ≤90d"
          value={counts.expiring_soon}
          tone="warn"
        />
        <Stat href="#missing" label="Missing dates" value={counts.missing} tone="muted" />
        <Stat
          href="#renewal"
          label="Under renewal"
          value={counts.under_renewal}
          tone="info"
        />
      </div>

      <p className="text-sm">
        <Link href="/manage/compliance/vault" className="text-[var(--primary)] underline">
          Open document vault
        </Link>
        {" · "}
        <Link href="/manage/compliance?view=queue" className="text-[var(--primary)] underline">
          Renewal queue
        </Link>
      </p>

      {error ? <p className="text-sm text-[var(--risk)]">{error.message}</p> : null}

      {overrideBoards?.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Active publish overrides</h2>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--google-yellow)]/40 bg-white">
            {overrideBoards.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <Link
                    href={`/manage/boards/${b.id}?tab=compliance`}
                    className="font-medium text-[var(--primary)] underline"
                  >
                    {b.board_code} · {b.name}
                  </Link>
                  <p className="text-[var(--muted)]">
                    Until {formatIstDate(b.compliance_publish_override_until)}
                    {b.compliance_publish_override_reason
                      ? ` · ${b.compliance_publish_override_reason}`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === "queue" ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Renewal queue</h2>
          <p className="text-sm text-[var(--muted)]">
            Under renewal first, then expired, then expiring — open Board 360 → Compliance to
            complete renewal.
          </p>
          {!queueRows.length ? (
            <p className="text-sm text-[var(--muted)]">Queue is clear.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {queueRows.map((r) => {
                const board = Array.isArray(r.boards) ? r.boards[0] : r.boards;
                const badge =
                  COMPLIANCE_BADGE[r.status as ComplianceStatus] ?? COMPLIANCE_BADGE.missing;
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <Link
                        href={`/manage/boards/${r.board_id}?tab=compliance`}
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        {board?.board_code ?? "Board"} · {board?.name}
                      </Link>
                      <p className="text-sm text-[var(--muted)]">
                        {r.clearance_type.replaceAll("_", " ")} · {r.governing_body}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-[var(--muted)]">
                        Exp {formatIstDate(r.expiry_date)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <>
          <RiskSection
            id="expired"
            title="Expired"
            empty="No expired mandatory clearances."
            rows={groups.expired}
          />
          <RiskSection
            id="expiring"
            title="Expiring within 90 days"
            empty="Nothing expiring in the next 90 days."
            rows={groups.expiring_soon}
          />
          <RiskSection
            id="missing"
            title="Missing expiry"
            empty="All clearances have expiry dates."
            rows={groups.missing}
          />
          <RiskSection
            id="renewal"
            title="Under renewal"
            empty="No renewals in progress."
            rows={groups.under_renewal}
          />
        </>
      )}
    </div>
  );
}

function Stat({
  href,
  label,
  value,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  tone: "risk" | "warn" | "muted" | "info";
}) {
  const toneClass =
    tone === "risk"
      ? "text-[var(--risk)]"
      : tone === "info"
        ? "text-[var(--primary)]"
        : tone === "muted"
          ? "text-[var(--muted)]"
          : "text-[var(--text-primary)]";
  const accent =
    tone === "warn" ? "border-t-2 border-t-[var(--google-yellow)]" : "";
  return (
    <a
      href={href}
      className={`rounded-lg border border-[var(--border)] bg-white p-4 hover:bg-[var(--surface)] ${accent}`}
    >
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className={`mt-2 font-[family-name:var(--font-display)] text-3xl ${toneClass}`}>
        {value}
      </p>
    </a>
  );
}

function RiskSection({
  id,
  title,
  empty,
  rows,
}: {
  id: string;
  title: string;
  empty: string;
  rows: Array<{
    id: string;
    board_id: string;
    clearance_type: string;
    governing_body: string;
    expiry_date: string | null;
    status: string;
    boards:
      | { board_code: string; name: string; city: string | null }
      | { board_code: string; name: string; city: string | null }[]
      | null;
  }>;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-lg font-medium">{title}</h2>
      {!rows.length ? (
        <p className="text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {rows.map((r) => {
            const board = Array.isArray(r.boards) ? r.boards[0] : r.boards;
            const badge =
              COMPLIANCE_BADGE[r.status as ComplianceStatus] ?? COMPLIANCE_BADGE.missing;
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link
                    href={`/manage/boards/${r.board_id}?tab=compliance`}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    {board?.board_code ?? "Board"} · {board?.name}
                  </Link>
                  <p className="text-sm text-[var(--muted)]">
                    {r.clearance_type.replaceAll("_", " ")} · {r.governing_body}
                    {board?.city ? ` · ${board.city}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[var(--muted)]">
                    Exp {formatIstDate(r.expiry_date)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
