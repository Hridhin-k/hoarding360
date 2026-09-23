import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateProofPackPdf } from "@/lib/proof/generate-proof-pack";

export const runtime = "nodejs";

/** Public shareable proof pack via token (no login). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const supabase = await createClient();
  const { data: meta, error } = await supabase.rpc("get_proof_share_board", {
    p_token: token,
  });

  if (error || !meta?.length) {
    return new Response("Link invalid or expired", { status: 404 });
  }

  const row = meta[0] as {
    board_id: string;
    board_code: string;
    board_name: string;
    org_name: string;
  };

  const admin = createAdminClient();
  const { data: board } = await admin
    .from("boards")
    .select(
      "id, organization_id, board_code, name, city, road_name, address_line, lat, lng",
    )
    .eq("id", row.board_id)
    .maybeSingle();

  if (!board) return new Response("Board missing", { status: 404 });

  const { data: proofRows } = await admin
    .from("proof_of_display")
    .select(
      "id, captured_at, geo_ok, distance_m, lat, lng, notes, photo_storage_path, review_status",
    )
    .eq("board_id", board.id)
    .is("deleted_at", null)
    .or("geo_ok.eq.true,review_status.in.(approved,waived)")
    .order("captured_at", { ascending: false })
    .limit(12);

  if (!proofRows?.length) {
    return new Response("No shareable proofs yet", { status: 404 });
  }

  const proofs = await Promise.all(
    proofRows.map(async (p) => {
      let photoBytes: Uint8Array | null = null;
      let photoMime: string | null = null;
      try {
        const { data: blob } = await admin.storage
          .from("field-proofs")
          .download(p.photo_storage_path);
        if (blob) {
          photoBytes = new Uint8Array(await blob.arrayBuffer());
          photoMime = blob.type || "image/jpeg";
        }
      } catch {
        /* ignore */
      }
      return {
        id: p.id,
        captured_at: p.captured_at,
        geo_ok: Boolean(p.geo_ok),
        distance_m: p.distance_m,
        lat: Number(p.lat),
        lng: Number(p.lng),
        notes: p.notes,
        photoBytes,
        photoMime,
      };
    }),
  );

  const pdf = await generateProofPackPdf({
    org: { name: row.org_name, brand_primary: "#1A73E8" },
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

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="proof-${board.board_code}.pdf"`,
    },
  });
}
