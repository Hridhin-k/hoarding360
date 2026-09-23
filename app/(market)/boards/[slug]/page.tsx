import Link from "next/link";
import { notFound } from "next/navigation";
import { marketSection } from "@/components/market/frame";
import { ListingGallery } from "@/components/market/listing-gallery";
import { fetchListingBySlug, fetchListingPhotos } from "@/lib/market/listings";
import { formatListingSize, listingAvailabilityTone } from "@/lib/domain/marketplace";
import { formatInrFromPaise, formatIstDate } from "@/lib/format";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await fetchListingBySlug(slug);
  if (!listing) notFound();
  const photos = await fetchListingPhotos(listing.board_id);

  const tone = listingAvailabilityTone(listing.available_label, listing.occupancy_status);
  const bar =
    tone === "available"
      ? "bg-[var(--google-green)]"
      : tone === "upcoming"
        ? "bg-[var(--google-yellow)]"
        : "bg-[var(--google-red)]";
  const availabilityClass =
    tone === "available"
      ? "text-[var(--google-green)]"
      : tone === "upcoming"
        ? "text-[var(--text-primary)]"
        : "text-[var(--google-red)]";

  return (
    <div className={`${marketSection} space-y-6`}>
      <Link href="/boards" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
        ← All boards
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <div className={`h-1.5 ${bar}`} aria-hidden />
          <ListingGallery
            title={listing.market_title ?? listing.board_name}
            photos={
              photos.length
                ? photos
                : listing.coverUrl
                  ? [{ kind: "day", url: listing.coverUrl }]
                  : []
            }
          />
        </div>
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              {listing.public_owner_name ?? "Verified owner"}
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl">
              {listing.market_title ?? `${listing.board_name} · Face ${listing.face_label}`}
            </h1>
            <p className="mt-2 text-[var(--muted)]">
              {[listing.road_name, listing.city, listing.state].filter(Boolean).join(" · ")}
            </p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
              <dt className="text-[var(--muted)]">Size</dt>
              <dd>{formatListingSize(listing)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
              <dt className="text-[var(--muted)]">Illumination</dt>
              <dd>{listing.illumination ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
              <dt className="text-[var(--muted)]">Facing</dt>
              <dd>{listing.facing_direction ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
              <dt className="text-[var(--muted)]">Availability</dt>
              <dd className={`font-medium ${availabilityClass}`}>
                {listing.available_label}
                {tone === "upcoming" ? (
                  <span
                    className="ml-2 inline-block h-2 w-2 rounded-full bg-[var(--google-yellow)] align-middle"
                    aria-hidden
                  />
                ) : null}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
              <dt className="text-[var(--muted)]">Rate</dt>
              <dd className="font-medium">
                {listing.price_on_request
                  ? "Price on request"
                  : formatInrFromPaise(listing.card_rate_paise)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
              <dt className="text-[var(--muted)]">Available from</dt>
              <dd>{formatIstDate(listing.available_from)}</dd>
            </div>
          </dl>

          {listing.market_blurb ? (
            <p className="text-sm text-[var(--muted)]">{listing.market_blurb}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 text-xs">
            {listing.compliance_ok ? (
              <span className="rounded-md border border-[var(--google-green)] bg-white px-2 py-1 font-medium text-[var(--google-green)]">
                Permit valid
              </span>
            ) : (
              <span className="rounded-md border border-[var(--google-red)] bg-white px-2 py-1 font-medium text-[var(--google-red)]">
                Permit check
              </span>
            )}
            {listing.photo_fresh ? (
              <span className="rounded-md border border-[var(--google-green)] bg-white px-2 py-1 font-medium text-[var(--google-green)]">
                Photo under 12 months
              </span>
            ) : (
              <span className="rounded-md border border-[var(--google-yellow)] bg-[var(--google-yellow)] px-2 py-1 font-medium text-[var(--text-primary)]">
                Photo aging
              </span>
            )}
          </div>

          <p className="text-sm text-[var(--muted)]">
            For advertisers: enquiry and hold ship with Marketplace cart (V2.0). Own this board?{" "}
            <Link
              href="/auth/login?next=/manage"
              className="underline hover:text-[var(--ink)]"
            >
              Manage CRM
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
