import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatIstDate } from "@/lib/format";

/** M06 / P2 — 180-day occupancy heat calendar (face × week) */
export default async function HeatCalendarPage() {
  const supabase = await createClient();
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 30);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 150);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);

  const { data: periods } = await supabase
    .from("occupancy_periods")
    .select(
      "id, face_id, status, starts_on, ends_on, board_faces(face_label, boards(id, board_code, name))",
    )
    .lte("starts_on", endIso)
    .or(`ends_on.is.null,ends_on.gte.${startIso}`)
    .limit(800);

  const weeks: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && weeks.length < 26) {
    weeks.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  type Row = {
    key: string;
    label: string;
    href: string;
    cells: ("occupied" | "blocked" | "booked" | "empty")[];
  };

  const byFace = new Map<string, Row>();
  for (const p of periods ?? []) {
    const face = Array.isArray(p.board_faces) ? p.board_faces[0] : p.board_faces;
    const board =
      face && "boards" in face
        ? Array.isArray(face.boards)
          ? face.boards[0]
          : face.boards
        : null;
    const key = p.face_id;
    if (!byFace.has(key)) {
      byFace.set(key, {
        key,
        label: `${(board as { board_code?: string } | null)?.board_code ?? "?"} · Face ${(face as { face_label?: string } | null)?.face_label ?? "?"}`,
        href:
          board && typeof (board as { id?: string }).id === "string"
            ? `/manage/boards/${(board as { id: string }).id}`
            : "/manage/boards",
        cells: weeks.map(() => "empty" as const),
      });
    }
    const row = byFace.get(key)!;
    weeks.forEach((w, i) => {
      const ends = p.ends_on ?? "9999-12-31";
      if (p.starts_on <= w && ends >= w) {
        if (p.status === "blocked") row.cells[i] = "blocked";
        else if (p.status === "booked_future") row.cells[i] = "booked";
        else row.cells[i] = "occupied";
      }
    });
  }

  const rows = [...byFace.values()].slice(0, 40);

  const color = (c: Row["cells"][number]) =>
    c === "occupied"
      ? "bg-[var(--google-blue)]"
      : c === "blocked"
        ? "bg-[var(--google-red)]"
        : c === "booked"
          ? "bg-[var(--google-yellow)]"
          : "bg-[var(--wash)]";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/manage" className="text-sm text-[var(--muted)]">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">Heat calendar</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          P2 · ~180 days · weekly columns · {formatIstDate(startIso)} → {formatIstDate(endIso)}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--google-blue)]" /> occupied
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--google-yellow)]" /> booked
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--google-red)]" /> blocked
        </span>
      </div>

      {!rows.length ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          No occupancy periods in this window.
        </p>
      ) : (
        <div className="overflow-auto rounded-lg border border-[var(--border)] bg-white">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                <th className="sticky left-0 bg-[var(--surface)] px-3 py-2">Face</th>
                {weeks.map((w) => (
                  <th key={w} className="px-1 py-2 font-normal text-[var(--muted)]">
                    {w.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-[var(--border)]">
                  <td className="sticky left-0 bg-white px-3 py-1.5 font-medium">
                    <Link href={r.href} className="hover:underline">
                      {r.label}
                    </Link>
                  </td>
                  {r.cells.map((c, i) => (
                    <td key={i} className="px-0.5 py-1">
                      <div className={`h-4 w-4 rounded-sm ${color(c)}`} title={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
