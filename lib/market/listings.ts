import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MarketplaceListing } from "@/lib/domain/marketplace";
import type { ListingPhoto } from "@/components/market/listing-gallery";

type CoverRow = Omit<MarketplaceListing, "coverUrl">;

const CARD_TRANSFORM = {
  width: 800,
  height: 500,
  resize: "cover" as const,
  quality: 60,
};

const HERO_TRANSFORM = {
  width: 1600,
  resize: "contain" as const,
  quality: 72,
};

type ImageTransform = typeof CARD_TRANSFORM | typeof HERO_TRANSFORM;

/** Sign unique storage paths once, resized for the slot they render in. */
async function signedUrlMap(
  paths: string[],
  transform: ImageTransform,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const urls = new Map<string, string>();
  if (!unique.length) return urls;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return urls;
  }

  await Promise.all(
    unique.map(async (path) => {
      const { data } = await admin.storage.from("board-images").createSignedUrl(path, 60 * 60, {
        transform,
      });
      if (data?.signedUrl) urls.set(path, data.signedUrl);
    }),
  );
  return urls;
}

/** Sign cover images for the rows that will actually render. */
export async function withSignedCovers(
  rows: CoverRow[],
  transform: ImageTransform = CARD_TRANSFORM,
): Promise<MarketplaceListing[]> {
  if (!rows.length) return [];
  const urls = await signedUrlMap(
    rows.map((r) => r.cover_storage_path).filter((p): p is string => Boolean(p)),
    transform,
  );
  return rows.map((r) => ({
    ...r,
    coverUrl: r.cover_storage_path ? (urls.get(r.cover_storage_path) ?? null) : null,
  }));
}

const LISTING_SELECT =
  "face_id, board_id, listing_slug, public_owner_name, board_code, board_name, city, state, road_name, lat, lng, face_label, width_ft, height_ft, area_sqft, illumination, facing_direction, card_rate_paise, price_on_request, occupancy_status, available_from, available_label, cover_storage_path, compliance_ok, photo_fresh, market_title, market_blurb";

export async function fetchListedMarketplace(opts?: {
  city?: string;
  limit?: number;
}): Promise<CoverRow[]> {
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
  return (data ?? []) as CoverRow[];
}

export async function fetchListingBySlug(slug: string): Promise<MarketplaceListing | null> {
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
  const [withUrl] = await withSignedCovers([data as CoverRow], HERO_TRANSFORM);
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

  const urls = await signedUrlMap(
    data.map((row) => row.storage_path),
    HERO_TRANSFORM,
  );

  return data.flatMap((row) => {
    const url = urls.get(row.storage_path);
    return url ? [{ kind: row.kind, url }] : [];
  });
}

/** Public catalogue. 5-minute cache; publish actions invalidate the tag. */
const loadMarketHome = unstable_cache(
  async () => {
    const rows = await fetchListedMarketplace({ limit: 48 });
    const preview = await withSignedCovers(rows.slice(0, 8));
    return { rows, preview };
  },
  ["market-home"],
  { revalidate: 300, tags: ["marketplace-listings"] },
);

const loadBoardListings = unstable_cache(
  async (city: string) =>
    withSignedCovers(await fetchListedMarketplace({ city: city || undefined, limit: 48 })),
  ["market-boards"],
  { revalidate: 300, tags: ["marketplace-listings"] },
);

const loadListingDetail = unstable_cache(
  async (slug: string) => {
    const listing = await fetchListingBySlug(slug);
    if (!listing) return null;
    const photos = await fetchListingPhotos(listing.board_id);
    return { listing, photos };
  },
  ["market-listing"],
  { revalidate: 300, tags: ["marketplace-listings"] },
);

export function getCachedMarketHome() {
  return loadMarketHome();
}

export function getCachedBoardListings(city?: string) {
  return loadBoardListings(city ?? "");
}

export function getCachedListingDetail(slug: string) {
  return loadListingDetail(slug);
}
