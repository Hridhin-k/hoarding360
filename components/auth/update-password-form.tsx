"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updError) {
      setError(updError.message);
      return;
    }
    router.push("/manage");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">New password</span>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Confirm password</span>
        <input
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
        />
      </label>
      {error ? <p className="text-sm text-[var(--google-red)]">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
