import { marketFrame } from "@/components/market/frame";
import { MarketHeader } from "@/components/shell/market-header";

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className={`${marketFrame} flex flex-col gap-2 py-6 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between`}>
          <p>
            <span className="font-medium text-[var(--ink)]">Marketplace</span>
            {" — "}
            browse listings to place outdoor ads. No floor rates. No client names.
          </p>
          <p className="sm:text-right">
            Own inventory?{" "}
            <a href="/auth/login?next=/manage" className="text-[var(--primary)] underline">
              Open Manage CRM
            </a>
            {" · "}
            Field staff?{" "}
            <a href="/auth/login?next=/field" className="text-[var(--primary)] underline">
              Open Field
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
