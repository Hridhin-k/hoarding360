"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  INCIDENT_CATEGORIES,
  PROOF_GEO_RADIUS_M,
  newOfflineId,
} from "@/lib/domain/field";
import {
  enqueueIncident,
  enqueueProof,
  fileToBase64,
} from "@/lib/field/offline-queue";
import { syncOfflineQueue } from "@/lib/field/sync";

type Face = { id: string; face_label: string };

type Props = {
  board: {
    id: string;
    organization_id: string;
    board_code: string;
    name: string;
    city: string | null;
    road_name: string | null;
    lat: number | null;
    lng: number | null;
    qr_token: string;
  };
  faces: Face[];
};

export function FieldBoardActions({ board, faces }: Props) {
  const [tab, setTab] = useState<"proof" | "incident">("proof");
  const [faceId, setFaceId] = useState(faces[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("damage");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function getPosition(): Promise<{
    lat: number;
    lng: number;
    accuracy: number | null;
  }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not available on this device"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
          }),
        (err) => reject(new Error(err.message || "Location permission denied")),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    });
  }

  async function submitProof(file: File | null) {
    if (!file) {
      setError("Take or choose a proof photo.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      const pos = await getPosition();
      const { base64, mime } = await fileToBase64(file);
      const offlineId = newOfflineId();
      const capturedAt = new Date().toISOString();

      const item = {
        clientOfflineId: offlineId,
        organizationId: board.organization_id,
        boardId: board.id,
        faceId: faceId || null,
        lat: pos.lat,
        lng: pos.lng,
        accuracyM: pos.accuracy,
        notes: notes.trim() || undefined,
        capturedAt,
        photoBase64: base64,
        photoMime: mime,
        boardCode: board.board_code,
      };

      if (!navigator.onLine) {
        await enqueueProof(item);
        setStatus(
          `Saved offline. Will check ≤${PROOF_GEO_RADIUS_M} m on sync.`,
        );
        setBusy(false);
        return;
      }

      const supabase = createClient();
      const { data: claims } = await supabase.auth.getClaims();
      const userId = claims?.claims?.sub as string | undefined;
      if (!userId) throw new Error("Not signed in");

      const path = `${board.organization_id}/${board.id}/proof-${offlineId}.jpg`;
      const { error: upError } = await supabase.storage
        .from("field-proofs")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upError) throw new Error(upError.message);

      const { data: row, error: rowError } = await supabase
        .from("proof_of_display")
        .insert({
          organization_id: board.organization_id,
          board_id: board.id,
          face_id: faceId || null,
          captured_by: userId,
          captured_at: capturedAt,
          lat: pos.lat,
          lng: pos.lng,
          accuracy_m: pos.accuracy,
          photo_storage_path: path,
          notes: notes.trim() || null,
          client_offline_id: offlineId,
        })
        .select("id, geo_ok, distance_m")
        .single();

      if (rowError) throw new Error(rowError.message);

      setStatus(
        row.geo_ok
          ? `Proof saved · within ${Math.round(row.distance_m ?? 0)} m (OK)`
          : `Proof saved · ${Math.round(row.distance_m ?? 0)} m away (outside ${PROOF_GEO_RADIUS_M} m)`,
      );
      setNotes("");
    } catch (e) {
      // Network failure mid-flight → queue for retry
      try {
        if (file) {
          const pos = await getPosition().catch(() => null);
          if (pos) {
            const { base64, mime } = await fileToBase64(file);
            await enqueueProof({
              clientOfflineId: newOfflineId(),
              organizationId: board.organization_id,
              boardId: board.id,
              faceId: faceId || null,
              lat: pos.lat,
              lng: pos.lng,
              accuracyM: pos.accuracy,
              notes: notes.trim() || undefined,
              capturedAt: new Date().toISOString(),
              photoBase64: base64,
              photoMime: mime,
              boardCode: board.board_code,
            });
            setStatus("Saved to offline queue (will sync later).");
            setError(null);
            setBusy(false);
            return;
          }
        }
      } catch {
        // fall through
      }
      setError(e instanceof Error ? e.message : "Could not save proof");
    }
    setBusy(false);
  }

  async function submitIncident(file: File | null) {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      const pos = await getPosition().catch(() => ({
        lat: null as number | null,
        lng: null as number | null,
        accuracy: null as number | null,
      }));
      const photo = file ? await fileToBase64(file) : null;
      const offlineId = newOfflineId();

      const item = {
        clientOfflineId: offlineId,
        organizationId: board.organization_id,
        boardId: board.id,
        title: title.trim(),
        category,
        severity,
        description: description.trim() || undefined,
        lat: pos.lat,
        lng: pos.lng,
        capturedAt: new Date().toISOString(),
        photoBase64: photo?.base64 ?? null,
        photoMime: photo?.mime ?? null,
        boardCode: board.board_code,
      };

      if (!navigator.onLine) {
        await enqueueIncident(item);
        setStatus("Incident saved offline.");
        setBusy(false);
        return;
      }

      const supabase = createClient();
      const { data: claims } = await supabase.auth.getClaims();
      const userId = claims?.claims?.sub as string | undefined;
      if (!userId) throw new Error("Not signed in");

      let photoPath: string | null = null;
      if (file && photo) {
        photoPath = `${board.organization_id}/${board.id}/incident-${offlineId}.jpg`;
        const { error: upError } = await supabase.storage
          .from("field-proofs")
          .upload(photoPath, file, { contentType: file.type, upsert: true });
        if (upError) throw new Error(upError.message);
      }

      const { error: rowError } = await supabase.from("incidents").insert({
        organization_id: board.organization_id,
        board_id: board.id,
        reported_by: userId,
        title: title.trim(),
        category,
        severity,
        description: description.trim() || null,
        lat: pos.lat,
        lng: pos.lng,
        photo_storage_path: photoPath,
        client_offline_id: offlineId,
        status: "open",
      });
      if (rowError) throw new Error(rowError.message);

      setStatus("Incident reported.");
      setTitle("");
      setDescription("");
      void syncOfflineQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save incident");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("proof")}
          className={`min-h-12 flex-1 rounded-md py-3 text-sm font-medium ${
            tab === "proof"
              ? "bg-[var(--accent)] text-white"
              : "border border-[var(--border)]"
          }`}
        >
          Proof of display
        </button>
        <button
          type="button"
          onClick={() => setTab("incident")}
          className={`min-h-12 flex-1 rounded-md py-3 text-sm font-medium ${
            tab === "incident"
              ? "bg-[var(--accent)] text-white"
              : "border border-[var(--border)]"
          }`}
        >
          Incident
        </button>
      </div>

      {tab === "proof" ? (
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--muted)]">
            GPS must be within {PROOF_GEO_RADIUS_M} m of the structure. Works offline → Queue.
          </p>
          {faces.length ? (
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Face</span>
              <select
                value={faceId}
                onChange={(e) => setFaceId(e.target.value)}
                className="rounded-md border border-[var(--border)] px-3 py-2"
              >
                {faces.map((f) => (
                  <option key={f.id} value={f.id}>
                    Face {f.face_label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--muted)]">Photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={busy}
              onChange={(e) => void submitProof(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-md border border-[var(--border)] px-3 py-2"
              >
                {INCIDENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Severity</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="rounded-md border border-[var(--border)] px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Photo (optional)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={busy}
              onChange={(e) => void submitIncident(e.target.files?.[0] ?? null)}
              className="block w-full"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitIncident(null)}
            className="min-h-12 w-full rounded-md bg-[var(--accent)] py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Report without photo"}
          </button>
        </div>
      )}

      {busy ? <p className="text-sm text-[var(--muted)]">Working…</p> : null}
      {status ? <p className="text-sm text-[var(--ok)]">{status}</p> : null}
      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}
    </div>
  );
}
