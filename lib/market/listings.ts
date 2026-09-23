import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MarketplaceListing } from "@/lib/domain/marketplace";
import type { ListingPhoto } from "@/components/market/listing-gallery";

/** Sign cover images for listed faces only (server-side). */
export async function withSignedCovers(
  rows: Omit<MarketplaceListing, "coverUrl">[],
): Promise<MarketplaceListing[]> {
  if (!rows.length) return [];

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return rows.map((r) => ({ ...r, coverUrl: null }));
  }

  return Promise.all(
    rows.map(async (r) => {
      if (!r.cover_storage_path) return { ...r, coverUrl: null };
      const { data } = await admin.storage
        .from("board-images")
        .createSignedUrl(r.cover_storage_path, 60 * 60);
      return { ...r, coverUrl: data?.signedUrl ?? null };
    }),
  );
}

const LISTING_SELECT =
  "face_id, board_id, listing_slug, public_owner_name, board_code, board_name, city, state, road_name, lat, lng, face_label, width_ft, height_ft, area_sqft, illumination, facing_direction, card_rate_paise, price_on_request, occupancy_status, available_from, available_label, cover_storage_path, compliance_ok, photo_fresh, market_title, market_blurb";

export async function fetchListedMarketplace(opts?: {
  city?: string;
  limit?: number;
}): Promise<MarketplaceListing[]> {
  // Public Market — anon client, no login required
  const supabase = createPublicClient();
  let q = supabase
    .from("marketplace_listings")
    .select(LISTING_SELECT)
    .eq("is_listed", true)
    .order("refreshed_at", { ascending: false })
    .limit(opts?.limit ?? 48);

  if (opts?.city) {
    q = q.ilike("city", opts.city);
  }

  const { data, error } = await q;
  if (error) {
    console.error("fetchListedMarketplace", error.message);
    return [];
  }
  return withSignedCovers((data ?? []) as Omit<MarketplaceListing, "coverUrl">[]);
}

export async function fetchListingBySlug(
  slug: string,
): Promise<MarketplaceListing | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select(LISTING_SELECT)
    .eq("listing_slug", slug)
    .eq("is_listed", true)
    .maybeSingle();

  if (error) {
    console.error("fetchListingBySlug", error.message);
    return null;
  }
  if (!data) return null;
  const [withUrl] = await withSignedCovers([
    data as Omit<MarketplaceListing, "coverUrl">,
  ]);
  return withUrl;
}

/** All board photos for a public listing, newest cover first. */
export async function fetchListingPhotos(boardId: string): Promise<ListingPhoto[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const { data, error } = await admin
    .from("board_photos")
    .select("kind, storage_path, is_cover")
    .eq("board_id", boardId)
    .is("deleted_at", null)
    .order("is_cover", { ascending: false })
    .order("created_at", { ascending: true });

  if (error || !data?.length) return [];

  const signed = await Promise.all(
    data.map(async (row) => {
      const { data: url } = await admin.storage
        .from("board-images")
        .createSignedUrl(row.storage_path, 60 * 60);
      if (!url?.signedUrl) return null;
      return { kind: row.kind, url: url.signedUrl };
    }),
  );

  return signed.filter((p): p is ListingPhoto => p != null);
}
