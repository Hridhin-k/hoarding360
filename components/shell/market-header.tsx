import Link from "next/link";
import { marketFrame } from "@/components/market/frame";

/** Public Marketplace chrome — advertisers only. Owner/Field entry is secondary. */
export function MarketHeader() {
  return (
    <header className="border-b border-[var(--border)] bg-white">
      <div className={`${marketFrame} flex min-h-16 flex-col justify-center gap-3 py-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-lg font-medium tracking-tight text-[var(--ink)]">
            HOARDINGS<span className="text-[var(--primary)]">360</span>
          </Link>
          <span className="hidden text-xs font-medium uppercase tracking-wide text-[var(--muted)] sm:inline">
            Marketplace
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
          <Link href="/boards" className="hover:text-[var(--ink)]">
            Browse boards
          </Link>
          <Link
            href="/auth/login?next=/manage"
            className="hover:text-[var(--ink)]"
            title="For media owners and staff"
          >
            Owner login
          </Link>
          <Link
            href="/auth/login?next=/field"
            className="hover:text-[var(--ink)]"
            title="For field technicians"
          >
            Field login
          </Link>
        </nav>
      </div>
    </header>
  );
}
