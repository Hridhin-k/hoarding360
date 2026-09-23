"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${origin}/auth/callback?next=/auth/update-password` },
    );
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-[var(--ink)]">
          If an account exists for that email, we sent a reset link. Check inbox and spam.
        </p>
        <Link href="/auth/login" className="text-[var(--primary)] underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
        />
      </label>
      {error ? <p className="text-sm text-[var(--google-red)]">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
