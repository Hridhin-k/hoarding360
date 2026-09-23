import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canOpenManageFromField, PRODUCTS } from "@/lib/domain/products";
import type { OrgRole } from "@/lib/domain/status";

export const metadata: Metadata = {
  title: "Field · HOARDINGS360",
  description: PRODUCTS.field.job,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "H360 Field",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A73E8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/login?next=/field");

  const userId = data.claims.sub as string;
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .is("deactivated_at", null)
    .limit(1)
    .maybeSingle();

  const role = membership?.role as OrgRole | undefined;
  const showManage = canOpenManageFromField(role);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--border)] bg-white px-4">
        <div>
          <Link href="/field" className="text-lg font-medium text-[var(--ink)]">
            Field
          </Link>
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
            Site tasks · your org only
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showManage ? (
            <Link
              href="/manage"
              className="min-h-11 px-2 py-2 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Manage CRM
            </Link>
          ) : null}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="min-h-11 px-2 py-2 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1 px-4 py-4 pb-24">{children}</div>
      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--border)] bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md justify-around text-sm">
          <Link
            href="/field"
            className="flex min-h-14 min-w-[4.5rem] flex-col items-center justify-center px-3 text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Home
          </Link>
          <Link
            href="/field/scan"
            className="flex min-h-14 min-w-[4.5rem] flex-col items-center justify-center px-3 font-medium text-[var(--primary)]"
          >
            Scan
          </Link>
          <Link
            href="/field/queue"
            className="flex min-h-14 min-w-[4.5rem] flex-col items-center justify-center px-3 text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Queue
          </Link>
        </div>
      </nav>
    </div>
  );
}
