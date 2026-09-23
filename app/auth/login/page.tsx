import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { PRODUCTS } from "@/lib/domain/products";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="text-2xl font-medium tracking-tight">
        HOARDINGS<span className="text-[var(--primary)]">360</span>
      </Link>
      <h1 className="mt-8 text-xl font-medium">Sign in</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Three products, one account — you land in the app that matches your role.
      </p>

      <ul className="mt-4 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">
        <li>
          <span className="font-medium text-[var(--ink)]">{PRODUCTS.manage.name}</span>
          {" — "}
          {PRODUCTS.manage.audience}
        </li>
        <li>
          <span className="font-medium text-[var(--ink)]">{PRODUCTS.field.name}</span>
          {" — "}
          {PRODUCTS.field.audience}
        </li>
        <li>
          <span className="font-medium text-[var(--ink)]">{PRODUCTS.market.name}</span>
          {" — "}
          public; no login required to browse
        </li>
      </ul>

      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-6 text-sm text-[var(--muted)]">
        No account?{" "}
        <Link href="/auth/signup" className="text-[var(--primary)] hover:underline">
          Create an owner account
        </Link>
        {" · "}
        <Link href="/boards" className="hover:underline">
          Browse Marketplace
        </Link>
      </p>
    </div>
  );
}
