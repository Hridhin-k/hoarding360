"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { signUpOwner } from "@/app/auth/actions";
import { PasswordInput } from "@/components/auth/password-input";

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signUpOwner({
      fullName,
      orgName,
      email,
      password,
    });

    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }

    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);
    if (signError) {
      setError(
        `Account created, but sign-in failed: ${signError.message}. Try Sign in.`,
      );
      return;
    }

    router.push("/manage");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Full name</span>
        <input
          required
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Company name</span>
        <input
          required
          autoComplete="organization"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Password</span>
        <PasswordInput
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
      </label>
      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
