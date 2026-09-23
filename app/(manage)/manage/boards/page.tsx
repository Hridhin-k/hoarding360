import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThreeStatusBadges, worstOccupancy } from "@/components/manage/status-badges";
import { worstCompliance } from "@/lib/domain/compliance";
import {
  LIFECYCLE_STATUSES,
  type ComplianceStatus,
  type OccupancyStatus,
} from "@/lib/domain/status";

export default async function BoardsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    city?: string;
    lifecycle?: string;
    compliance?: string;
    occupancy?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: boards, error } = await supabase
    .from("boards")
    .select(
      "id, board_code, name, city, structure_type, lifecycle_status, created_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);

  const ids = (boards ?? []).map((b) => b.id);
  const facesByBoard = new Map<string, OccupancyStatus[]>();
  const complianceByBoard = new Map<string, ComplianceStatus[]>();

  if (ids.length) {
    const [{ data: faces }, { data: records }] = await Promise.all([
      supabase
        .from("board_faces")
        .select("board_id, occupancy_status")
        .in("board_id", ids)
        .is("deleted_at", null),
      supabase
        .from("compliance_records")
        .select("board_id, status, is_mandatory")
        .in("board_id", ids)
        .is("deleted_at", null)
        .eq("is_mandatory", true),
    ]);

    for (const f of faces ?? []) {
      const list = facesByBoard.get(f.board_id) ?? [];
      list.push(f.occupancy_status as OccupancyStatus);
      facesByBoard.set(f.board_id, list);
    }
    for (const r of records ?? []) {
      const list = complianceByBoard.get(r.board_id) ?? [];
      list.push(r.status as ComplianceStatus);
      complianceByBoard.set(r.board_id, list);
    }
  }

  const cities = [
    ...new Set((boards ?? []).map((b) => b.city).filter(Boolean) as string[]),
  ].sort();

  const q = sp.q?.trim().toLowerCase() ?? "";
  const filtered = (boards ?? []).filter((b) => {
    if (sp.lifecycle && b.lifecycle_status !== sp.lifecycle) return false;
    if (sp.city && b.city !== sp.city) return false;
    if (
      q &&
      !b.board_code.toLowerCase().includes(q) &&
      !b.name.toLowerCase().includes(q)
    ) {
      return false;
    }
    const occ = worstOccupancy(facesByBoard.get(b.id) ?? []);
    const compList = complianceByBoard.get(b.id) ?? [];
    const compliance = (compList.length
      ? worstCompliance(compList)
      : "missing") as ComplianceStatus;
    if (sp.occupancy && occ !== sp.occupancy) return false;
    if (sp.compliance && compliance !== sp.compliance) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-[var(--ink)]">Boards</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            M02 · {filtered.length} shown · three status badges stay separate
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/manage/boards/map"
            className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--wash)]"
          >
            Map
          </Link>
          <Link
            href="/manage/boards/new"
            className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--ink-soft)]"
          >
            Add board
          </Link>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Search</span>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Code or name"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">City</span>
          <select
            name="city"
            defaultValue={sp.city ?? ""}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          >
            <option value="">All</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Lifecycle</span>
          <select
            name="lifecycle"
            defaultValue={sp.lifecycle ?? ""}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          >
            <option value="">All</option>
            {LIFECYCLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Compliance</span>
          <select
            name="compliance"
            defaultValue={sp.compliance ?? ""}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          >
            <option value="">All</option>
            <option value="valid">valid</option>
            <option value="expiring_soon">expiring soon</option>
            <option value="expired">expired</option>
            <option value="missing">missing</option>
            <option value="under_renewal">under renewal</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Occupancy</span>
          <select
            name="occupancy"
            defaultValue={sp.occupancy ?? ""}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          >
            <option value="">All</option>
            <option value="vacant">vacant</option>
            <option value="becoming_vacant">becoming vacant</option>
            <option value="occupied">occupied</option>
            <option value="booked_future">booked future</option>
            <option value="blocked">blocked</option>
            <option value="on_hold">on hold</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          Filter
        </button>
        <Link href="/manage/boards" className="text-sm text-[var(--muted)] underline">
          Clear
        </Link>
      </form>

      {error ? (
        <p className="mt-6 text-sm text-red-600">{error.message}</p>
      ) : !filtered.length ? (
        <div className="mt-10 rounded-lg border border-dashed border-[var(--border)] bg-white p-10 text-center">
          <p className="text-[var(--ink)]">No boards match</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            <Link href="/manage/import" className="underline">
              Import CSV / Excel
            </Link>{" "}
            or clear filters.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--wash)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Structure</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const occ = worstOccupancy(facesByBoard.get(b.id) ?? []);
                const compList = complianceByBoard.get(b.id) ?? [];
                const compliance = compList.length
                  ? worstCompliance(compList)
                  : ("missing" as ComplianceStatus);
                return (
                  <tr
                    key={b.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--wash)]"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/manage/boards/${b.id}`} className="underline">
                        {b.board_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/manage/boards/${b.id}`}
                        className="font-medium text-[var(--ink)] hover:underline"
                      >
                        {b.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{b.city ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{b.structure_type}</td>
                    <td className="px-4 py-3">
                      <ThreeStatusBadges
                        lifecycle={b.lifecycle_status}
                        compliance={compliance}
                        occupancy={occ}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
