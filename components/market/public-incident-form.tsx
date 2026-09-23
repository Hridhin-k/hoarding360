"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/browser";

export function PublicIncidentForm({ qrToken, boardCode }: { qrToken: string; boardCode: string }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("damage");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <p className="rounded-lg border border-[var(--border)] bg-white p-6 text-sm text-[var(--ink)]">
        Thanks — your report for <strong>{boardCode}</strong> was submitted to the media owner.
      </p>
    );
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-[var(--border)] bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const supabase = createClient();
          let lat: number | null = null;
          let lng: number | null = null;
          try {
            const pos = await new Promise<GeolocationPosition>((res, rej) =>
              navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }),
            );
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          } catch {
            /* optional */
          }
          const { error: rpcError } = await supabase.rpc("submit_public_incident_report", {
            p_qr_token: qrToken,
            p_title: title,
            p_category: category,
            p_description: description || null,
            p_reporter_name: name || null,
            p_reporter_phone: phone || null,
            p_lat: lat,
            p_lng: lng,
          });
          if (rpcError) setError(rpcError.message);
          else setDone(true);
        });
      }}
    >
      <h2 className="text-sm font-medium">Report an issue · {boardCode}</h2>
      <p className="text-xs text-[var(--muted)]">P2 · Anonymous public QR report</p>
      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">What happened</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        >
          <option value="damage">Damage</option>
          <option value="illumination">Illumination</option>
          <option value="encroachment">Encroachment</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Details</span>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Your name (optional)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Phone (optional)</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
      </div>
      {error ? <p className="text-sm text-[var(--google-red)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Submit report"}
      </button>
    </form>
  );
}
