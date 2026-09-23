"use client";

import { createClient } from "@/lib/supabase/browser";
import {
  base64ToBlob,
  listPendingIncidents,
  listPendingProofs,
  removePendingIncident,
  removePendingProof,
} from "@/lib/field/offline-queue";

export type SyncResult = {
  proofsOk: number;
  incidentsOk: number;
  errors: string[];
};

export async function syncOfflineQueue(): Promise<SyncResult> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) {
    return { proofsOk: 0, incidentsOk: 0, errors: ["Not signed in"] };
  }

  const errors: string[] = [];
  let proofsOk = 0;
  let incidentsOk = 0;

  const proofs = await listPendingProofs();
  for (const p of proofs) {
    try {
      const blob = base64ToBlob(p.photoBase64, p.photoMime);
      const path = `${p.organizationId}/${p.boardId}/proof-${p.clientOfflineId}.jpg`;
      const { error: upError } = await supabase.storage
        .from("field-proofs")
        .upload(path, blob, { contentType: p.photoMime, upsert: true });
      if (upError) throw new Error(upError.message);

      const { error: rowError } = await supabase.from("proof_of_display").insert({
        organization_id: p.organizationId,
        board_id: p.boardId,
        face_id: p.faceId || null,
        captured_by: userId,
        captured_at: p.capturedAt,
        lat: p.lat,
        lng: p.lng,
        accuracy_m: p.accuracyM ?? null,
        photo_storage_path: path,
        notes: p.notes || null,
        client_offline_id: p.clientOfflineId,
      });
      if (rowError) {
        if (rowError.message.includes("duplicate") || rowError.code === "23505") {
          await removePendingProof(p.clientOfflineId);
          proofsOk += 1;
          continue;
        }
        throw new Error(rowError.message);
      }
      await removePendingProof(p.clientOfflineId);
      proofsOk += 1;
    } catch (e) {
      errors.push(
        `Proof ${p.boardCode ?? p.boardId}: ${e instanceof Error ? e.message : "failed"}`,
      );
    }
  }

  const incidents = await listPendingIncidents();
  for (const inc of incidents) {
    try {
      let photoPath: string | null = null;
      if (inc.photoBase64 && inc.photoMime) {
        const blob = base64ToBlob(inc.photoBase64, inc.photoMime);
        photoPath = `${inc.organizationId}/${inc.boardId}/incident-${inc.clientOfflineId}.jpg`;
        const { error: upError } = await supabase.storage
          .from("field-proofs")
          .upload(photoPath, blob, { contentType: inc.photoMime, upsert: true });
        if (upError) throw new Error(upError.message);
      }

      const { error: rowError } = await supabase.from("incidents").insert({
        organization_id: inc.organizationId,
        board_id: inc.boardId,
        reported_by: userId,
        title: inc.title,
        category: inc.category,
        severity: inc.severity,
        description: inc.description || null,
        lat: inc.lat ?? null,
        lng: inc.lng ?? null,
        photo_storage_path: photoPath,
        client_offline_id: inc.clientOfflineId,
        status: "open",
      });
      if (rowError) {
        if (rowError.message.includes("duplicate") || rowError.code === "23505") {
          await removePendingIncident(inc.clientOfflineId);
          incidentsOk += 1;
          continue;
        }
        throw new Error(rowError.message);
      }
      await removePendingIncident(inc.clientOfflineId);
      incidentsOk += 1;
    } catch (e) {
      errors.push(
        `Incident ${inc.boardCode ?? inc.boardId}: ${e instanceof Error ? e.message : "failed"}`,
      );
    }
  }

  return { proofsOk, incidentsOk, errors };
}
