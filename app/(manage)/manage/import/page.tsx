import Link from "next/link";
import { requireManageSession } from "@/lib/supabase/session";
import { BoardImportWizard } from "@/components/manage/board-import-wizard";
import { EntityImportWizard } from "@/components/manage/entity-import-wizard";
import { BulkPhotoImport } from "@/components/manage/bulk-photo-import";
import { formatIstDate } from "@/lib/format";

const TABS = [
  { key: "boards", label: "Boards" },
  { key: "clients", label: "Clients" },
  { key: "agreements", label: "Agreements" },
  { key: "permits", label: "Permits" },
  { key: "photos", label: "Photos" },
  { key: "history", label: "Job history" },
] as const;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const sp = await searchParams;
  const kind = TABS.some((t) => t.key === sp.kind) ? sp.kind! : "boards";

  const { supabase, orgId } = await requireManageSession("/manage/import");

  const { data: jobs } =
    kind === "history"
      ? await supabase
          .from("import_jobs")
          .select("id, entity_kind, status, summary, created_at, finished_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: null };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/manage/boards" className="text-sm text-[var(--muted)]">
          ← Boards
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          Bulk import
        </h1>
        <p className="text-sm text-[var(--muted)]">
          M10 · Boards, clients, agreements, permits, photos · CSV / Excel
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/manage/import?kind=${t.key}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              kind === t.key
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border)] bg-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {kind === "boards" ? (
        <BoardImportWizard organizationId={orgId} />
      ) : null}
      {kind === "clients" || kind === "agreements" || kind === "permits" ? (
        <EntityImportWizard
          organizationId={orgId}
          kind={kind}
        />
      ) : null}
      {kind === "photos" ? (
        <BulkPhotoImport organizationId={orgId} />
      ) : null}
      {kind === "history" ? (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          {(jobs ?? []).map((j) => (
            <li key={j.id} className="px-4 py-3 text-sm">
              <p className="font-medium">
                {j.entity_kind} · {j.status}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {formatIstDate(j.created_at.slice(0, 10))}
                {j.finished_at ? ` → ${formatIstDate(j.finished_at.slice(0, 10))}` : ""}
                {" · "}
                {JSON.stringify(j.summary ?? {})}
              </p>
            </li>
          ))}
          {!jobs?.length ? (
            <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              No import jobs yet
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
