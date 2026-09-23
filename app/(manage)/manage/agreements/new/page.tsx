import Link from "next/link";
import { redirect } from "next/navigation";
import { AgreementForm } from "@/components/manage/agreement-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewAgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; face?: string }>;
}) {
  const { client: defaultClientId, face: defaultFaceId } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId ?? "")
    .is("deactivated_at", null)
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) redirect("/manage");

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  const { data: faceRows } = await supabase
    .from("board_faces")
    .select(
      "id, face_label, card_rate_paise, occupancy_status, board_id, boards(board_code, name)",
    )
    .is("deleted_at", null)
    .order("face_label");

  const faces = (faceRows ?? []).map((f) => {
    const board = Array.isArray(f.boards) ? f.boards[0] : f.boards;
    return {
      id: f.id,
      face_label: f.face_label,
      card_rate_paise: f.card_rate_paise,
      occupancy_status: f.occupancy_status,
      board_id: f.board_id as string,
      board_code: board?.board_code ?? "—",
      board_name: board?.name ?? "",
    };
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/manage/clients" className="text-sm text-[var(--muted)]">
          ← Clients
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          New agreement
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Overlapping dates on the same face are blocked automatically.
        </p>
      </div>
      <AgreementForm
        organizationId={membership.organization_id}
        clients={clients ?? []}
        faces={faces}
        defaultClientId={defaultClientId}
        defaultFaceId={defaultFaceId}
      />
    </div>
  );
}
