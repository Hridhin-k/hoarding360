import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardForm } from "@/components/manage/board-form";
import { requireManageSession } from "@/lib/supabase/session";
import { emptyFace, type BoardFormValues } from "@/lib/domain/board";
import { canSeeFloorRates } from "@/lib/domain/roles";
import type { LifecycleStatus } from "@/lib/domain/status";

export default async function EditBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, orgId, role } = await requireManageSession(`/manage/boards/${id}/edit`);
  const showFloor = canSeeFloorRates(role);

  const { data: board } = await supabase
    .from("boards")
    .select(
      "id, organization_id, board_code, name, structure_type, ownership_type, installed_on, ward_zone, street_view_url, meter_no, lifecycle_status, address_line, landmark, city, district, state, pin_code, road_name, lat, lng, how_to_reach",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!board) notFound();

  const { data: faces } = await supabase
    .from("board_faces")
    .select(
      "id, face_label, width_ft, height_ft, illumination, card_rate_paise, floor_rate_paise, printing_charge_paise, mounting_charge_paise, facing_direction",
    )
    .eq("board_id", id)
    .is("deleted_at", null)
    .order("face_label");

  const paiseToRupees = (p: number | null | undefined) =>
    p != null ? String(Math.round(Number(p) / 100)) : "";

  const initial: BoardFormValues = {
    board_code: board.board_code,
    name: board.name,
    structure_type: board.structure_type,
    ownership_type: board.ownership_type ?? "owned",
    installed_on: board.installed_on ?? "",
    ward_zone: board.ward_zone ?? "",
    street_view_url: board.street_view_url ?? "",
    meter_no: board.meter_no ?? "",
    lifecycle_status: board.lifecycle_status as LifecycleStatus,
    address_line: board.address_line ?? "",
    landmark: board.landmark ?? "",
    city: board.city ?? "",
    district: board.district ?? "",
    state: board.state ?? "",
    pin_code: board.pin_code ?? "",
    road_name: board.road_name ?? "",
    lat: board.lat != null ? String(board.lat) : "",
    lng: board.lng != null ? String(board.lng) : "",
    how_to_reach: board.how_to_reach ?? "",
    faces: (faces ?? []).map((f) => ({
      face_label: f.face_label,
      width_ft: f.width_ft != null ? String(f.width_ft) : "",
      height_ft: f.height_ft != null ? String(f.height_ft) : "",
      illumination: f.illumination ?? "nonlit",
      card_rate_rupees: paiseToRupees(f.card_rate_paise),
      floor_rate_rupees: paiseToRupees(f.floor_rate_paise),
      printing_charge_rupees: paiseToRupees(f.printing_charge_paise),
      mounting_charge_rupees: paiseToRupees(f.mounting_charge_paise),
      facing_direction: f.facing_direction ?? "",
    })),
  };

  if (!initial.faces.length) {
    initial.faces = [emptyFace("A")];
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/manage/boards/${id}`}
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← Board 360
        </Link>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">Edit board</h1>
        <p className="text-sm text-[var(--muted)]">{board.board_code}</p>
      </div>
      <BoardForm
        organizationId={orgId}
        mode="edit"
        boardId={id}
        initial={initial}
        existingFaceIds={(faces ?? []).map((f) => f.id)}
        showFloorRates={showFloor}
      />
    </div>
  );
}
