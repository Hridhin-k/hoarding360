import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/login?next=/admin");

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link
            href="/admin"
            className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]"
          >
            Super Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <Link href="/manage" className="hover:text-[var(--ink)]">
              Manage
            </Link>
            <Link href="/" className="hover:text-[var(--ink)]">
              Market
            </Link>
            <form action="/auth/signout" method="post">
              <button type="submit" className="hover:text-[var(--ink)]">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
