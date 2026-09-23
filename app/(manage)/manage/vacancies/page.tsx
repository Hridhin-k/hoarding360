import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatInrFromPaise, formatIstDate } from "@/lib/format";

const WINDOWS = [30, 60, 90] as const;

export default async function VacanciesPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; city?: string }>;
}) {
  const sp = await searchParams;
  const days =
    sp.days === "30" || sp.days === "60" || sp.days === "90" ? Number(sp.days) : 90;

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("upcoming_vacancies")
    .select(
      "face_id, board_id, board_code, board_name, city, face_label, card_rate_paise, occupancy_status, available_from",
    )
    .order("available_from", { ascending: true })
    .limit(400);

  const ceil = new Date();
  ceil.setUTCDate(ceil.getUTCDate() + days);
  const ceilIso = ceil.toISOString().slice(0, 10);

  const cities = [
    ...new Set((rows ?? []).map((r) => r.city).filter(Boolean) as string[]),
  ].sort();

  const filtered = (rows ?? []).filter((r) => {
    if (!r.available_from || r.available_from > ceilIso) return false;
    if (sp.city && r.city !== sp.city) return false;
    return true;
  });

  const pipelinePaise = filtered.reduce(
    (s, r) => s + Number(r.card_rate_paise ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-[var(--ink)]">
            Vacancies
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            M06 · Pre-listing window · {filtered.length} faces · card-rate pipeline{" "}
            {formatInrFromPaise(pipelinePaise)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/manage/availability"
            className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
          >
            Availability search
          </Link>
          <Link
            href="/manage/agreements/new"
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            New agreement
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <Link
            key={w}
            href={`/manage/vacancies?days=${w}${sp.city ? `&city=${encodeURIComponent(sp.city)}` : ""}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              days === w
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border)] bg-white text-[var(--ink)]"
            }`}
          >
            {w} days
          </Link>
        ))}
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="days" value={String(days)} />
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
        <button
          type="submit"
          className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm"
        >
          Apply
        </button>
      </form>

      {error ? (
        <p className="mt-6 text-sm text-[var(--google-red)]">{error.message}</p>
      ) : !filtered.length ? (
        <div className="mt-10 rounded-lg border border-dashed border-[var(--border)] bg-white p-10 text-center">
          <p className="text-[var(--ink)]">No vacancies in this window</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Try 90 days or check{" "}
            <Link href="/manage/availability" className="underline">
              availability search
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Board</th>
                <th className="px-4 py-3 font-medium">Face</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Available from</th>
                <th className="px-4 py-3 font-medium">Occupancy</th>
                <th className="px-4 py-3 font-medium">Card rate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr
                  key={v.face_id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--wash)]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/manage/boards/${v.board_id}?tab=occupancy`}
                      className="font-medium text-[var(--primary)] underline"
                    >
                      {v.board_code}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{v.board_name}</p>
                  </td>
                  <td className="px-4 py-3">{v.face_label}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{v.city ?? "—"}</td>
                  <td className="px-4 py-3">{formatIstDate(v.available_from)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs">
                      {v.occupancy_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatInrFromPaise(v.card_rate_paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
