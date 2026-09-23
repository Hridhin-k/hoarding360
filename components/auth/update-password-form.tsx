"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { PasswordInput } from "@/components/auth/password-input";

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
        <PasswordInput
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Confirm password</span>
        <PasswordInput
          required
          minLength={6}
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
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
