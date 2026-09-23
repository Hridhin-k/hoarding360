import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatInrFromPaise, formatIstDate } from "@/lib/format";

export default async function ReportsPage() {
  const supabase = await createClient();

  const [{ count: boardCount }, { count: agrCount }, { data: loss }] =
    await Promise.all([
      supabase
        .from("boards")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("vacancy_loss_faces")
        .select("board_code, face_label, days_vacant, loss_paise, city")
        .order("loss_paise", { ascending: false })
        .limit(8),
    ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            M09 · Export boards / agreements / vacancies ·{" "}
            {formatIstDate(new Date().toISOString().slice(0, 10))}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/manage/reports/export?format=csv"
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
          >
            Boards CSV
          </a>
          <a
            href="/manage/reports/export?format=xlsx"
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Excel workbook
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Boards</p>
          <p className="mt-2 text-2xl font-medium">{boardCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Agreements</p>
          <p className="mt-2 text-2xl font-medium">{agrCount ?? 0}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Top vacancy loss faces</h2>
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-white">
          {(loss ?? []).map((r, i) => (
            <li
              key={`${r.board_code}-${r.face_label}-${i}`}
              className="flex justify-between px-4 py-2 text-sm"
            >
              <span>
                {r.board_code} · {r.face_label} · {r.days_vacant}d · {r.city ?? ""}
              </span>
              <span>{formatInrFromPaise(r.loss_paise)}</span>
            </li>
          ))}
          {!loss?.length ? (
            <li className="px-4 py-6 text-center text-sm text-[var(--muted)]">No loss rows</li>
          ) : null}
        </ul>
      </section>

      <p className="text-sm text-[var(--muted)]">
        <Link href="/manage/vacancies" className="underline">
          Vacancy pipeline
        </Link>
        {" · "}
        <Link href="/manage/calendar" className="underline">
          Heat calendar
        </Link>
      </p>
    </div>
  );
}
