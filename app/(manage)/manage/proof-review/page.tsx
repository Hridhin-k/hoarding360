import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProofReviewActions } from "@/components/manage/proof-review-actions";

export default async function ProofReviewPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("proof_of_display")
    .select(
      "id, board_id, captured_at, geo_ok, distance_m, review_status, review_notes, lat, lng, boards(board_code, name)",
    )
    .eq("geo_ok", false)
    .eq("review_status", "pending")
    .is("deleted_at", null)
    .order("captured_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Proof geo review</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          M12 · Supervisor queue · proofs outside 150 m radius
        </p>
      </div>

      {!rows?.length ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          No pending geo-fails. Field proofs within radius auto-approve.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          {rows.map((p) => {
            const board = Array.isArray(p.boards) ? p.boards[0] : p.boards;
            return (
              <li key={p.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/manage/boards/${p.board_id}?tab=proof`}
                      className="font-medium text-[var(--primary)] underline"
                    >
                      {(board as { board_code?: string } | null)?.board_code} ·{" "}
                      {(board as { name?: string } | null)?.name}
                    </Link>
                    <p className="text-[var(--muted)]">
                      {Math.round(p.distance_m ?? 0)} m away ·{" "}
                      {new Date(p.captured_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </p>
                  </div>
                </div>
                <ProofReviewActions proofId={p.id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
