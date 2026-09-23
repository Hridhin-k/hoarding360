/** M10 multi-entity import helpers (clients, agreements, permits) */

import { parseCsv } from "@/lib/domain/import-boards";

export type ImportEntityKind = "boards" | "clients" | "agreements" | "permits";

export const CLIENT_IMPORT_HEADERS = [
  "name",
  "gstin",
  "industry",
  "billing_address",
  "payment_terms",
  "contact_name",
  "contact_email",
  "contact_phone",
] as const;

export const AGREEMENT_IMPORT_HEADERS = [
  "client_name",
  "board_code",
  "face_label",
  "starts_on",
  "ends_on",
  "rate_rupees",
  "ref_code",
  "value_rupees",
  "status",
] as const;

export const PERMIT_IMPORT_HEADERS = [
  "board_code",
  "clearance_type",
  "governing_body",
  "reference_no",
  "issue_date",
  "expiry_date",
  "is_mandatory",
] as const;

export const SAMPLE_CLIENT_CSV = [
  CLIENT_IMPORT_HEADERS.join(","),
  "Acme Retail,29AAAAA0000A1Z5,Retail,MG Road Bengaluru,Net 30,Priya Shah,priya@acme.example,+919876543210",
].join("\n");

export const SAMPLE_AGREEMENT_CSV = [
  AGREEMENT_IMPORT_HEADERS.join(","),
  "Acme Retail,BLR-HSR-0142,A,2026-04-01,2026-09-30,60000,AGR-ACME-001,360000,active",
].join("\n");

export const SAMPLE_PERMIT_CSV = [
  PERMIT_IMPORT_HEADERS.join(","),
  "BLR-HSR-0142,municipal_licence,BBMP,LIC-2026-001,2026-01-01,2026-12-31,true",
].join("\n");

export type GenericValidatedRow = {
  _row: number;
  ok: boolean;
  errors: string[];
  raw: Record<string, string>;
};

function headersFromMatrix(matrix: string[][]): string[] {
  return (matrix[0] ?? []).map((h) => h.trim());
}

export function matrixToObjects(
  matrix: string[][],
  required: readonly string[],
): { objects: Record<string, string>[]; headers: string[] } {
  const headers = headersFromMatrix(matrix);
  const lower = headers.map((h) => h.toLowerCase());
  for (const r of required) {
    if (!lower.includes(r.toLowerCase())) {
      throw new Error(`Missing column: ${r}`);
    }
  }
  const objects: Record<string, string>[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const obj: Record<string, string> = { _row: String(i + 1) };
    headers.forEach((h, idx) => {
      obj[h.trim().toLowerCase()] = String(row[idx] ?? "").trim();
    });
    objects.push(obj);
  }
  return { objects, headers };
}

export function validateClientRows(
  objects: Record<string, string>[],
): GenericValidatedRow[] {
  return objects.map((raw, i) => {
    const errors: string[] = [];
    if (!raw.name?.trim()) errors.push("name required");
    return {
      _row: Number(raw._row) || i + 2,
      ok: errors.length === 0,
      errors,
      raw,
    };
  });
}

export function validateAgreementRows(
  objects: Record<string, string>[],
): GenericValidatedRow[] {
  return objects.map((raw, i) => {
    const errors: string[] = [];
    if (!raw.client_name?.trim()) errors.push("client_name required");
    if (!raw.board_code?.trim()) errors.push("board_code required");
    if (!raw.face_label?.trim()) errors.push("face_label required");
    if (!raw.starts_on?.trim()) errors.push("starts_on required");
    if (!raw.ends_on?.trim()) errors.push("ends_on required");
    if (raw.starts_on && raw.ends_on && raw.ends_on < raw.starts_on) {
      errors.push("ends_on before starts_on");
    }
    return {
      _row: Number(raw._row) || i + 2,
      ok: errors.length === 0,
      errors,
      raw,
    };
  });
}

export function validatePermitRows(
  objects: Record<string, string>[],
): GenericValidatedRow[] {
  return objects.map((raw, i) => {
    const errors: string[] = [];
    if (!raw.board_code?.trim()) errors.push("board_code required");
    if (!raw.clearance_type?.trim()) errors.push("clearance_type required");
    if (!raw.governing_body?.trim()) errors.push("governing_body required");
    return {
      _row: Number(raw._row) || i + 2,
      ok: errors.length === 0,
      errors,
      raw,
    };
  });
}

export function parseImportFileText(text: string): string[][] {
  return parseCsv(text);
}

export function rupeesToPaise(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export function truthyFlag(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return true;
  return v === "true" || v === "1" || v === "yes" || v === "y";
}
