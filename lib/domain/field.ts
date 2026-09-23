/** M11 / M12 Field domain — QR, proof of display, incidents */

export const PROOF_GEO_RADIUS_M = 150;

export const INCIDENT_STATUSES = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
  "closed",
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_CATEGORIES = [
  { value: "damage", label: "Damage / vandalism" },
  { value: "illumination", label: "Illumination fault" },
  { value: "encroachment", label: "Encroachment" },
  { value: "access", label: "Access blocked" },
  { value: "creative", label: "Creative issue" },
  { value: "other", label: "Other" },
] as const;

export type PendingProof = {
  clientOfflineId: string;
  organizationId: string;
  boardId: string;
  faceId?: string | null;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  notes?: string;
  capturedAt: string;
  /** data URL or blob stored as base64 */
  photoBase64: string;
  photoMime: string;
  boardCode?: string;
};

export type PendingIncident = {
  clientOfflineId: string;
  organizationId: string;
  boardId: string;
  title: string;
  category: string;
  severity: string;
  description?: string;
  lat?: number | null;
  lng?: number | null;
  capturedAt: string;
  photoBase64?: string | null;
  photoMime?: string | null;
  boardCode?: string;
};

export function newOfflineId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `off-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function fieldBoardPath(qrToken: string): string {
  return `/field/b/${qrToken}`;
}
