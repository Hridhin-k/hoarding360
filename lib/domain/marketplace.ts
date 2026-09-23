/** M25 marketplace projection helpers */

export type MarketplaceListing = {
  face_id: string;
  board_id: string;
  listing_slug: string;
  public_owner_name: string | null;
  board_code: string;
  board_name: string;
  city: string | null;
  state: string | null;
  road_name: string | null;
  lat: number | null;
  lng: number | null;
  face_label: string;
  width_ft: number | null;
  height_ft: number | null;
  area_sqft: number | null;
  illumination: string | null;
  facing_direction: string | null;
  card_rate_paise: number | null;
  price_on_request: boolean;
  occupancy_status: string | null;
  available_from: string | null;
  available_label: string | null;
  cover_storage_path: string | null;
  compliance_ok: boolean;
  photo_fresh: boolean;
  market_title: string | null;
  market_blurb: string | null;
  coverUrl?: string | null;
};

/** Green = free now, yellow = dated availability, red = held or booked. */
export type ListingAvailabilityTone = "available" | "upcoming" | "held";

export function listingAvailabilityTone(
  label: string | null,
  status: string | null,
): ListingAvailabilityTone {
  const text = `${label ?? ""} ${status ?? ""}`.toLowerCase();
  if (text.includes("available now") || status === "vacant") return "available";
  if (
    text.includes("available from") ||
    status === "becoming_vacant" ||
    status === "booked_future"
  ) {
    return "upcoming";
  }
  return "held";
}

export function formatListingSize(l: {
  width_ft: number | null;
  height_ft: number | null;
  area_sqft: number | null;
}): string {
  if (l.width_ft != null && l.height_ft != null) {
    return `${l.width_ft}×${l.height_ft} ft`;
  }
  if (l.area_sqft != null) return `${l.area_sqft} sq ft`;
  return "—";
}
