import { createClient } from "@/lib/supabase/server";
import { FieldHomeClient } from "@/components/field/field-home-client";

export default async function FieldHomePage() {
  const supabase = await createClient();

  const { data: proofs } = await supabase
    .from("proof_of_display")
    .select("id, geo_ok, captured_at, boards(board_code)")
    .is("deleted_at", null)
    .order("captured_at", { ascending: false })
    .limit(8);

  const recentProofs = (proofs ?? []).map((p) => {
    const board = Array.isArray(p.boards) ? p.boards[0] : p.boards;
    return {
      id: p.id as string,
      board_code: board?.board_code ?? "—",
      geo_ok: Boolean(p.geo_ok),
      captured_at: p.captured_at as string,
    };
  });

  return <FieldHomeClient recentProofs={recentProofs} />;
}
