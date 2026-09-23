/** M03 polymorphic documents */

export const DOCUMENT_TYPES = [
  { value: "municipal_licence", label: "Municipal licence" },
  { value: "traffic_noc", label: "Traffic NOC" },
  { value: "structural_certificate", label: "Structural certificate" },
  { value: "electricity_bill", label: "Electricity bill" },
  { value: "lease_deed", label: "Lease deed" },
  { value: "agreement", label: "Agreement / contract" },
  { value: "tax_receipt", label: "Tax receipt" },
  { value: "photo_proof", label: "Photo proof" },
  { value: "other", label: "Other" },
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number]["value"];

export type VaultDocument = {
  id: string;
  doc_type: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  byte_size: number | null;
  reference_no: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  created_at: string;
  version_no?: number | null;
  is_current?: boolean | null;
  signedUrl?: string | null;
};

export function documentTypeLabel(value: string): string {
  return DOCUMENT_TYPES.find((d) => d.value === value)?.label ?? value;
}

/** Heuristic auto-classify from filename (P2 bulk upload). */
export function classifyDocFromFilename(fileName: string): DocumentType {
  const n = fileName.toLowerCase();
  if (/noc|traffic/.test(n)) return "traffic_noc";
  if (/struct|stability|engineer/.test(n)) return "structural_certificate";
  if (/electric|meter|kseb|ebill/.test(n)) return "electricity_bill";
  if (/lease|rent/.test(n)) return "lease_deed";
  if (/agree|contract|msa/.test(n)) return "agreement";
  if (/tax|gst|receipt/.test(n)) return "tax_receipt";
  if (/photo|proof|pod|display/.test(n)) return "photo_proof";
  if (/municipal|licence|license|permit|advertis/.test(n)) {
    return "municipal_licence";
  }
  return "other";
}
