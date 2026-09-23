import Link from "next/link";
import { marketSection } from "@/components/market/frame";
import { MarketListingCard } from "@/components/market/listing-card";
import { listingAvailabilityTone } from "@/lib/domain/marketplace";
import { fetchListedMarketplace } from "@/lib/market/listings";
import { PRODUCTS } from "@/lib/domain/products";

const highlights = [
  {
    tone: "available" as const,
    title: "Available now",
    body: "Vacant faces you can shortlist for a campaign today.",
    mark: "bg-[var(--google-green)]",
    count: "text-[var(--google-green)]",
  },
  {
    tone: "upcoming" as const,
    title: "Opening soon",
    body: "Still on a live campaign — free from a known date.",
    mark: "bg-[var(--google-yellow)]",
    count: "text-[var(--text-primary)]",
  },
  {
    tone: "held" as const,
    title: "On hold / booked",
    body: "Not open to enquire — shown so you don’t chase a dead board.",
    mark: "bg-[var(--google-red)]",
    count: "text-[var(--google-red)]",
  },
];

export default async function MarketHomePage() {
  const listings = await fetchListedMarketplace({ limit: 48 });
  const preview = listings.slice(0, 8);
  const counts = {
    available: listings.filter(
      (l) => listingAvailabilityTone(l.available_label, l.occupancy_status) === "available",
    ).length,
    upcoming: listings.filter(
      (l) => listingAvailabilityTone(l.available_label, l.occupancy_status) === "upcoming",
    ).length,
    held: listings.filter(
      (l) => listingAvailabilityTone(l.available_label, l.occupancy_status) === "held",
    ).length,
  };

  return (
    <div className="flex flex-1 flex-col bg-white">
      <section className={marketSection}>
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          {PRODUCTS.market.name} · for advertisers
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-[var(--text-primary)] sm:text-4xl">
          Find outdoor boards to place your ad.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--text-secondary)]">
          Public catalogue of verified inventory from media owners. Green is free now, yellow
          opens on a date, red is held. You see card rates and availability only — never floor
          prices, costs, or other brands&apos; contracts.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/boards"
            className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white"
          >
            Browse listings
          </Link>
          <Link
            href="/auth/login?next=/manage"
            className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]"
          >
            I own boards → Manage CRM
          </Link>
        </div>

        <div className="mt-10 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <div className="grid sm:grid-cols-3">
            {highlights.map((item, index) => (
              <Link
                key={item.tone}
                href="/boards"
                className={`flex gap-4 px-5 py-5 hover:bg-[var(--surface)] ${
                  index > 0 ? "border-t border-[var(--border)] sm:border-t-0 sm:border-l" : ""
                }`}
              >
                <span className={`mt-1 h-8 w-1 shrink-0 rounded-full ${item.mark}`} aria-hidden />
                <span className="min-w-0">
                  <span className={`block text-3xl font-medium leading-none ${item.count}`}>
                    {counts[item.tone]}
                  </span>
                  <span className="mt-3 block text-sm font-medium text-[var(--text-primary)]">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--text-secondary)]">
                    {item.body}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className={marketSection}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-[var(--text-primary)]">
                Latest public listings
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {listings.length
                  ? "Published by owners from Manage · enquire coming in V2.0"
                  : "Nothing listed yet. Owners publish faces from Manage after GPS, photo, and a valid permit."}
              </p>
            </div>
            <Link href="/boards" className="text-sm font-medium text-[var(--primary)]">
              View all
            </Link>
          </div>
          {preview.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {preview.map((l) => (
                <MarketListingCard key={l.face_id} listing={l} />
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--text-secondary)]">
              No live listings yet.
            </p>
          )}
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-white">
        <div className={`${marketSection} grid gap-6 sm:grid-cols-3`}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Product 1
            </p>
            <h3 className="mt-1 font-medium text-[var(--ink)]">{PRODUCTS.market.name}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{PRODUCTS.market.job}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Product 2
            </p>
            <h3 className="mt-1 font-medium text-[var(--ink)]">
              {PRODUCTS.manage.name} (CRM)
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{PRODUCTS.manage.job}</p>
            <Link
              href="/auth/login?next=/manage"
              className="mt-2 inline-block text-sm text-[var(--primary)] underline"
            >
              Owner sign-in
            </Link>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Product 3
            </p>
            <h3 className="mt-1 font-medium text-[var(--ink)]">{PRODUCTS.field.name} PWA</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{PRODUCTS.field.job}</p>
            <Link
              href="/auth/login?next=/field"
              className="mt-2 inline-block text-sm text-[var(--primary)] underline"
            >
              Field sign-in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
