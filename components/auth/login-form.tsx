"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { defaultAppPathForRole } from "@/lib/domain/products";
import { PasswordInput } from "@/components/auth/password-input";
import { PendingButton, btnPrimary } from "@/components/ui/pending-button";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.startsWith("/auth")) return null;
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextHint = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signError) {
      setLoading(false);
      setError(signError.message);
      return;
    }

    if (nextHint) {
      setLoading(false);
      router.push(nextHint);
      router.refresh();
      return;
    }

    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub as string | undefined;
    let role: string | null = null;
    if (userId) {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", userId)
        .is("deactivated_at", null)
        .limit(1)
        .maybeSingle();
      role = membership?.role ?? null;
    }

    setLoading(false);
    router.push(defaultAppPathForRole(role));
    router.refresh();
  }

  const destinationLabel =
    nextHint?.startsWith("/field")
      ? "Field PWA"
      : nextHint?.startsWith("/admin")
        ? "Super Admin"
        : nextHint?.startsWith("/manage")
          ? "Manage CRM"
          : null;

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      {destinationLabel ? (
        <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
          Signing in to <span className="font-medium text-[var(--ink)]">{destinationLabel}</span>
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Password</span>
        <PasswordInput
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
      </label>
      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}
      <PendingButton type="submit" pending={loading} pendingLabel="Signing in…" className={btnPrimary}>
        Sign in
      </PendingButton>
      <p className="text-center text-sm text-[var(--muted)]">
        <Link href="/auth/forgot-password" className="text-[var(--primary)] hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
