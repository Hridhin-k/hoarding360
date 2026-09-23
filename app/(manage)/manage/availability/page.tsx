import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OccupancyBlockForm } from "@/components/manage/occupancy-block-form";
import { formatInrFromPaise, formatIstDate } from "@/lib/format";

function overlapsRange(
  starts: string | null,
  ends: string | null,
  from: string,
  to: string,
): boolean {
  if (!starts || !ends) return false;
  return starts <= to && ends >= from;
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; city?: string }>;
}) {
  const { from: fromParam, to: toParam, city } = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/auth/login?next=/manage/availability");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .is("deactivated_at", null)
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) redirect("/manage");

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const from = fromParam || today;
  const to =
    toParam ||
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
      new Date(Date.now() + 30 * 86400000),
    );

  const { data: faces } = await supabase
    .from("board_faces")
    .select(
      "id, face_label, card_rate_paise, occupancy_status, available_from, board_id, boards!inner(board_code, name, city, lifecycle_status)",
    )
    .eq("organization_id", membership.organization_id)
    .is("deleted_at", null)
    .order("face_label");

  const faceIds = (faces ?? []).map((f) => f.id);
  const { data: periods } = faceIds.length
    ? await supabase
        .from("occupancy_periods")
        .select("face_id, starts_on, ends_on, status, agreement_id, block_reason")
        .in("face_id", faceIds)
    : { data: [] as never[] };

  const busy = new Set<string>();
  for (const p of periods ?? []) {
    if (overlapsRange(p.starts_on, p.ends_on, from, to)) {
      busy.add(p.face_id);
    }
  }

  const free = (faces ?? []).filter((f) => {
    const board = Array.isArray(f.boards) ? f.boards[0] : f.boards;
    if ((board as { lifecycle_status?: string } | null)?.lifecycle_status === "retired") {
      return false;
    }
    if (city && (board as { city?: string } | null)?.city !== city) return false;
    return !busy.has(f.id);
  });

  const cities = [
    ...new Set(
      (faces ?? [])
        .map((f) => {
          const board = Array.isArray(f.boards) ? f.boards[0] : f.boards;
          return (board as { city?: string } | null)?.city;
        })
        .filter(Boolean) as string[],
    ),
  ].sort();

  const blockFaces = (faces ?? []).map((f) => {
    const board = Array.isArray(f.boards) ? f.boards[0] : f.boards;
    return {
      id: f.id,
      label: `${(board as { board_code?: string })?.board_code ?? "?"} · Face ${f.face_label}`,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-[var(--ink)]">
          Availability
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          M06 · Faces free for the whole date range · {formatIstDate(from)} →{" "}
          {formatIstDate(to)}
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">From</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">To</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">City</span>
          <select
            name="city"
            defaultValue={city ?? ""}
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
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          Search
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          Free faces · {free.length}
        </h2>
        {!free.length ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
            No faces free for that whole range.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-white">
            {free.map((f) => {
              const board = Array.isArray(f.boards) ? f.boards[0] : f.boards;
              return (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/manage/boards/${f.board_id}?tab=occupancy`}
                      className="font-medium text-[var(--primary)] hover:underline"
                    >
                      {(board as { board_code?: string })?.board_code} · Face {f.face_label}
                    </Link>
                    <p className="text-[var(--muted)]">
                      {(board as { name?: string })?.name}
                      {(board as { city?: string })?.city
                        ? ` · ${(board as { city?: string }).city}`
                        : ""}{" "}
                      · {f.occupancy_status}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{formatInrFromPaise(f.card_rate_paise)}</span>
                    <Link
                      href={`/manage/agreements/new`}
                      className="text-xs text-[var(--primary)] underline"
                    >
                      Book
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <OccupancyBlockForm
        organizationId={membership.organization_id}
        faces={blockFaces}
      />
    </div>
  );
}
