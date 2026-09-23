import Link from "next/link";
import { formatInrFromPaise } from "@/lib/format";
import {
  formatListingSize,
  listingAvailabilityTone,
  type MarketplaceListing,
} from "@/lib/domain/marketplace";

const toneStyle = {
  available: {
    bar: "bg-[var(--google-green)]",
    chip: "bg-white text-[var(--google-green)] border border-[var(--google-green)]",
  },
  upcoming: {
    bar: "bg-[var(--google-yellow)]",
    chip: "bg-[var(--google-yellow)] text-[var(--text-primary)] border border-[var(--google-yellow)]",
  },
  held: {
    bar: "bg-[var(--google-red)]",
    chip: "bg-white text-[var(--google-red)] border border-[var(--google-red)]",
  },
} as const;

export function MarketListingCard({ listing: l }: { listing: MarketplaceListing }) {
  const tone = listingAvailabilityTone(l.available_label, l.occupancy_status);
  const style = toneStyle[tone];

  return (
    <Link
      href={`/boards/${l.listing_slug}`}
      className="group block overflow-hidden rounded-xl border border-[var(--border)] bg-white hover:border-[var(--primary)] hover:bg-[var(--surface)]"
    >
      <div className={`h-1.5 ${style.bar}`} aria-hidden />
      <div className="aspect-[16/10] bg-[var(--surface)]">
        {l.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={l.coverUrl}
            alt={l.market_title ?? l.board_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
            No photo
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <p className="font-medium text-[var(--text-primary)] group-hover:text-[var(--primary)]">
          {l.market_title ?? `${l.board_name} · ${l.face_label}`}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          {[l.city, l.road_name].filter(Boolean).join(" · ") || "Location TBD"}
          {" · "}
          {formatListingSize(l)}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${style.chip}`}>
            {l.available_label ?? "Status unknown"}
          </span>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {l.price_on_request ? "Price on request" : formatInrFromPaise(l.card_rate_paise)}
          </span>
        </div>
      </div>
    </Link>
  );
}
