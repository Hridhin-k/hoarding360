import Link from "next/link";
import { notFound } from "next/navigation";
import { FieldBoardActions } from "@/components/field/field-board-actions";
import { createClient } from "@/lib/supabase/server";

export default async function FieldBoardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("lookup_board_by_qr", { p_token: token });
  const board = Array.isArray(data) ? data[0] : data;
  if (!board?.id) notFound();

  const { data: faces } = await supabase
    .from("board_faces")
    .select("id, face_label")
    .eq("board_id", board.id)
    .is("deleted_at", null)
    .order("face_label");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/field/scan" className="text-sm text-[var(--muted)]">
          ← Scan another
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl">
          {board.board_code}
        </h1>
        <p className="text-[var(--ink)]">{board.name}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {[board.road_name, board.city].filter(Boolean).join(" · ") || "—"}
          {board.lat != null && board.lng != null
            ? ` · ${Number(board.lat).toFixed(5)}, ${Number(board.lng).toFixed(5)}`
            : " · no GPS on board"}
        </p>
      </div>

      <FieldBoardActions
        board={{
          id: board.id,
          organization_id: board.organization_id,
          board_code: board.board_code,
          name: board.name,
          city: board.city,
          road_name: board.road_name,
          lat: board.lat,
          lng: board.lng,
          qr_token: board.qr_token,
        }}
        faces={faces ?? []}
      />

      <a
        href={`/api/proof-pack?boardId=${board.id}`}
        className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] py-3 text-center text-sm font-medium text-[var(--accent)]"
      >
        Download proof pack PDF
      </a>
    </div>
  );
}
