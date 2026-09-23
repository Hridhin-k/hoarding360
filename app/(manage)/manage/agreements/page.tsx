import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatInrFromPaise, formatIstDate } from "@/lib/format";

const STATUSES = ["draft", "active", "expired", "terminated", "cancelled"] as const;

function addDaysIso(days: number): string {
  const d = new Date();
  // Approximate IST calendar day in UTC+5:30 for filter ceiling
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    ending?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: agreements, error } = await supabase
    .from("agreements")
    .select(
      "id, ref_code, status, starts_on, ends_on, value_paise, clients(name), created_at",
    )
    .is("deleted_at", null)
    .order("ends_on", { ascending: true })
    .limit(300);

  const q = sp.q?.trim().toLowerCase() ?? "";
  const endingDays = sp.ending === "30" || sp.ending === "60" || sp.ending === "90"
    ? Number(sp.ending)
    : null;
  const endingCeil = endingDays != null ? addDaysIso(endingDays) : null;
  const today = addDaysIso(0);

  const filtered = (agreements ?? []).filter((a) => {
    if (sp.status && a.status !== sp.status) return false;
    if (endingCeil) {
      if (a.status === "terminated" || a.status === "cancelled") return false;
      if (a.ends_on < today || a.ends_on > endingCeil) return false;
    }
    if (q) {
      const client = Array.isArray(a.clients) ? a.clients[0] : a.clients;
      const name = (client as { name?: string } | null)?.name?.toLowerCase() ?? "";
      const ref = (a.ref_code ?? "").toLowerCase();
      if (!name.includes(q) && !ref.includes(q)) return false;
    }
    return true;
  });

  const atRiskPaise = filtered
    .filter((a) => endingCeil && a.status === "active")
    .reduce((s, a) => s + Number(a.value_paise ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-[var(--ink)]">Agreements</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            M05 · {filtered.length} shown
            {endingDays
              ? ` · ending in ${endingDays}d · value at risk ${formatInrFromPaise(atRiskPaise)}`
              : ""}
          </p>
        </div>
        <Link
          href="/manage/agreements/new"
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          New agreement
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Search</span>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Client or ref"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Status</span>
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Ending within</span>
          <select
            name="ending"
            defaultValue={sp.ending ?? ""}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          >
            <option value="">Any</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          Filter
        </button>
        <Link href="/manage/agreements" className="text-sm text-[var(--muted)] underline">
          Clear
        </Link>
      </form>

      {error ? (
        <p className="mt-6 text-sm text-[var(--google-red)]">{error.message}</p>
      ) : !filtered.length ? (
        <div className="mt-10 rounded-lg border border-dashed border-[var(--border)] bg-white p-10 text-center">
          <p className="text-[var(--ink)]">No agreements match</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Book a face or clear filters.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Ref</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const client = Array.isArray(a.clients) ? a.clients[0] : a.clients;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--wash)]"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/manage/agreements/${a.id}`}
                        className="underline hover:text-[var(--ink)]"
                      >
                        {a.ref_code || a.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/manage/agreements/${a.id}`}
                        className="font-medium text-[var(--ink)] hover:underline"
                      >
                        {(client as { name?: string } | null)?.name ?? "Client"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {formatIstDate(a.starts_on)} → {formatIstDate(a.ends_on)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs">
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatInrFromPaise(a.value_paise)}</td>
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
