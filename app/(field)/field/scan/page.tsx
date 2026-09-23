"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { fieldBoardPath } from "@/lib/domain/field";
import { FieldQrCamera } from "@/components/field/field-qr-camera";

export default function FieldScanPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function go(raw: string) {
    const value = raw.trim();
    if (!value) {
      setError("Enter a QR token or paste the Field URL.");
      return;
    }
    setLoading(true);
    setError(null);

    let resolved = value;
    try {
      if (value.includes("/field/b/")) {
        resolved = value.split("/field/b/")[1]?.split(/[?#]/)[0] ?? value;
      } else if (value.startsWith("http")) {
        const u = new URL(value);
        const parts = u.pathname.split("/field/b/");
        if (parts[1]) resolved = parts[1].split("/")[0];
      }
    } catch {
      // keep raw
    }

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("lookup_board_by_qr", {
      p_token: resolved,
    });

    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.qr_token) {
      setError("No board found for that QR. Check the token or your org membership.");
      return;
    }
    router.push(fieldBoardPath(row.qr_token));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">Scan QR</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Use the camera, or paste a Field URL / token.
        </p>
      </div>

      <FieldQrCamera disabled={loading} onDetect={(raw) => void go(raw)} />

      <div className="border-t border-[var(--border)] pt-4">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Or paste token / URL</span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste /field/b/… or token"
            className="rounded-md border border-[var(--border)] bg-white px-3 py-3 text-base"
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>

        <button
          type="button"
          disabled={loading}
          onClick={() => void go(token)}
          className="mt-3 min-h-12 w-full rounded-lg border border-[var(--border)] bg-white py-3 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Looking up…" : "Open board"}
        </button>
      </div>

      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}
    </div>
  );
}
