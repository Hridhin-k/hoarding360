import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateProofPackPdf } from "@/lib/proof/generate-proof-pack";
import { logActivity } from "@/lib/domain/activity";

export const runtime = "nodejs";

const MAX_PROOFS = 12;

/**
 * GET /api/proof-pack?boardId=uuid
 * Branded Proof of Display PDF for a board (auth + org RLS).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("boardId");
  if (!boardId) {
    return NextResponse.json({ error: "boardId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select(
      "id, organization_id, board_code, name, city, road_name, address_line, lat, lng, organizations(name, brand_primary)",
    )
    .eq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle();

  if (boardError || !board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const org = Array.isArray(board.organizations)
    ? board.organizations[0]
    : board.organizations;

  const { data: proofRows, error: proofError } = await supabase
    .from("proof_of_display")
    .select(
      "id, captured_at, geo_ok, distance_m, lat, lng, notes, photo_storage_path",
    )
    .eq("board_id", boardId)
    .is("deleted_at", null)
    .order("captured_at", { ascending: false })
    .limit(MAX_PROOFS);

  if (proofError) {
    return NextResponse.json({ error: proofError.message }, { status: 500 });
  }

  if (!proofRows?.length) {
    return NextResponse.json(
      { error: "No proofs to include. Capture a proof in Field first." },
      { status: 400 },
    );
  }

  const proofs = await Promise.all(
    proofRows.map(async (p) => {
      let photoBytes: Uint8Array | null = null;
      let photoMime: string | null = null;
      try {
        const { data: blob, error: dlError } = await supabase.storage
          .from("field-proofs")
          .download(p.photo_storage_path);
        if (!dlError && blob) {
          photoBytes = new Uint8Array(await blob.arrayBuffer());
          photoMime = blob.type || "image/jpeg";
        }
      } catch {
        photoBytes = null;
      }
      return {
        id: p.id as string,
        captured_at: p.captured_at as string,
        geo_ok: Boolean(p.geo_ok),
        distance_m: p.distance_m as number | null,
        lat: Number(p.lat),
        lng: Number(p.lng),
        notes: (p.notes as string | null) ?? null,
        photoBytes,
        photoMime,
      };
    }),
  );

  const pdfBytes = await generateProofPackPdf({
    org: {
      name: org?.name ?? "Media owner",
      brand_primary: org?.brand_primary ?? null,
    },
    board: {
      board_code: board.board_code,
      name: board.name,
      city: board.city,
      road_name: board.road_name,
      address_line: board.address_line,
      lat: board.lat,
      lng: board.lng,
    },
    proofs,
  });

  await logActivity(supabase, {
    organizationId: board.organization_id,
    entityType: "board",
    entityId: board.id,
    eventType: "proof.pack_generated",
    boardId: board.id,
    toValue: { proofs: proofs.length },
  });

  const filename = `proof-pack-${board.board_code.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
