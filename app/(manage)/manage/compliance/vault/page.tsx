import Link from "next/link";
import { requireManageSession } from "@/lib/supabase/session";
import { documentTypeLabel } from "@/lib/domain/documents";
import { formatIstDate } from "@/lib/format";
import { BulkDocUpload } from "@/components/manage/bulk-doc-upload";

/** M03 · Org-wide document vault search (current versions) + P2 bulk upload */
export default async function ComplianceVaultPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; expiring?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireManageSession("/manage/compliance/vault");

  let query = supabase
    .from("documents")
    .select(
      "id, doc_type, file_name, storage_path, reference_no, expiry_date, created_at, entity_type, entity_id, version_no, is_current",
    )
    .is("deleted_at", null)
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(300);

  if (sp.type) query = query.eq("doc_type", sp.type);
  if (sp.expiring === "1") {
    const in30 = new Date();
    in30.setUTCDate(in30.getUTCDate() + 30);
    query = query
      .not("expiry_date", "is", null)
      .lte("expiry_date", in30.toISOString().slice(0, 10));
  }

  const [{ data: docRows }, { data: boards }] = await Promise.all([
    query,
    supabase
      .from("boards")
      .select("id, board_code, name")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("board_code")
      .limit(200),
  ]);

  const q = sp.q?.trim().toLowerCase() ?? "";
  const filtered = (docRows ?? []).filter((d) => {
    if (!q) return true;
    return (
      d.file_name.toLowerCase().includes(q) ||
      (d.reference_no ?? "").toLowerCase().includes(q) ||
      d.doc_type.toLowerCase().includes(q)
    );
  });

  const listed = filtered.slice(0, 80);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/manage/compliance" className="text-sm text-[var(--muted)]">
          ← Compliance risk
        </Link>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">Document vault</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          M03 · Current versions · search by type / expiry · bulk upload with auto-classify
        </p>
      </div>

      <BulkDocUpload
        organizationId={orgId}
        boards={boards ?? []}
      />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Search</span>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Type</span>
          <select
            name="type"
            defaultValue={sp.type ?? ""}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          >
            <option value="">All</option>
            <option value="municipal_licence">Municipal licence</option>
            <option value="traffic_noc">Traffic NOC</option>
            <option value="structural_certificate">Structural</option>
            <option value="electricity_bill">Electricity</option>
            <option value="lease_deed">Lease</option>
            <option value="agreement">Agreement</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="expiring"
            value="1"
            defaultChecked={sp.expiring === "1"}
          />
          Expiring ≤30d
        </label>
        <button
          type="submit"
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm text-white"
        >
          Filter
        </button>
      </form>

      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-white">
        {listed.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {documentTypeLabel(d.doc_type)} · v{d.version_no ?? 1}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {d.file_name}
                {d.reference_no ? ` · ${d.reference_no}` : ""}
                {d.expiry_date ? ` · exp ${formatIstDate(d.expiry_date)}` : ""}
                {` · ${d.entity_type}`}
              </p>
            </div>
            <a
              href={`/manage/compliance/vault/open?id=${d.id}`}
              className="text-xs text-[var(--primary)] underline"
            >
              Open
            </a>
          </li>
        ))}
        {!listed.length ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No documents match
          </li>
        ) : null}
      </ul>
    </div>
  );
}
