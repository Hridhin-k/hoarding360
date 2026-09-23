import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortfolioMapLibre } from "@/components/manage/portfolio-map-libre";
import { memberGeoScope } from "@/lib/domain/authz";

export default async function BoardsMapPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const scope = userId ? await memberGeoScope(userId) : null;

  let boardQuery = supabase
    .from("boards")
    .select("id, board_code, name, city, district, lat, lng, lifecycle_status")
    .is("deleted_at", null)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("board_code")
    .limit(500);

  if (scope?.cities.length) {
    boardQuery = boardQuery.in("city", scope.cities);
  } else if (scope?.districts.length) {
    boardQuery = boardQuery.in("district", scope.districts);
  }

  const { data: boards } = await boardQuery;

  const withGps = (boards ?? []).map((b) => ({
    id: b.id,
    board_code: b.board_code,
    name: b.name,
    lat: Number(b.lat),
    lng: Number(b.lng),
    lifecycle_status: b.lifecycle_status,
  }));

  const ids = withGps.map((b) => b.id);
  const occByBoard = new Map<string, string>();
  if (ids.length) {
    const { data: faces } = await supabase
      .from("board_faces")
      .select("board_id, occupancy_status")
      .in("board_id", ids)
      .is("deleted_at", null);
    for (const f of faces ?? []) {
      if (!occByBoard.has(f.board_id)) occByBoard.set(f.board_id, f.occupancy_status);
    }
  }

  const pins = withGps.map((b) => ({
    ...b,
    occupancy: occByBoard.get(b.id) ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/manage/boards" className="text-sm text-[var(--muted)]">
            ← Boards
          </Link>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">Portfolio map</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            M09 · MapLibre · pins coloured by lifecycle
            {scope?.cities.length || scope?.districts.length
              ? " · filtered to your geo scope"
              : ""}
          </p>
        </div>
      </div>
      {!pins.length ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          No boards with GPS in scope.
        </p>
      ) : (
        <PortfolioMapLibre boards={pins} />
      )}
    </div>
  );
}
