import Link from "next/link";
import { marketSection } from "@/components/market/frame";
import { MarketListingCard } from "@/components/market/listing-card";
import { fetchListedMarketplace } from "@/lib/market/listings";

export default async function BoardsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city } = await searchParams;
  const listings = await fetchListedMarketplace({ city: city || undefined });

  const cities = [
    ...new Set(listings.map((l) => l.city).filter(Boolean) as string[]),
  ].sort();

  return (
    <div className={`${marketSection} space-y-8`}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--google-red)]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--google-yellow)]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--google-green)]" aria-hidden />
          <p className="ml-1 text-sm text-[var(--text-secondary)]">
            Marketplace · place an outdoor ad
          </p>
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-[var(--text-primary)] sm:text-4xl">
          Boards for your campaign
        </h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Public listings only — card rates, size, city, and availability. Owners publish from
          Manage CRM. Floor rates, costs, and client names never appear here.
        </p>
        <div className="rounded-md border border-[var(--border)] bg-[var(--wash)] px-4 py-3 text-sm text-[var(--muted)]">
          No login required · {listings.length} listed face
          {listings.length === 1 ? "" : "s"} · enquiry cart ships in V2.0
        </div>
      </div>

      {cities.length ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/boards"
            className={`rounded-md px-3 py-1.5 ${
              !city
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            All
          </Link>
          {cities.map((c) => (
            <Link
              key={c}
              href={`/boards?city=${encodeURIComponent(c)}`}
              className={`rounded-md px-3 py-1.5 ${
                city === c
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      ) : null}

      {!listings.length ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
          No live listings yet. In Manage: enable org marketplace, set board to{" "}
          <strong>active</strong>, add GPS + photo + valid permit, then publish a face.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((l) => (
            <MarketListingCard key={l.face_id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
