"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { logActivity } from "@/lib/domain/activity";
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  type VaultDocument,
} from "@/lib/domain/documents";
import { formatIstDate } from "@/lib/format";

const inputClass =
  "rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

type Props = {
  organizationId: string;
  entityType: "board" | "agreement" | "client" | "compliance_record";
  entityId: string;
  boardId?: string | null;
  documents: VaultDocument[];
  title?: string;
};

/** M03 polymorphic document vault — board, agreement, client, clearance. */
export function EntityDocumentsVault({
  organizationId,
  entityType,
  entityId,
  boardId = null,
  documents,
  title = "Document vault",
}: Props) {
  const router = useRouter();
  const [docType, setDocType] = useState<string>(
    entityType === "agreement" ? "agreement" : "municipal_licence",
  );
  const [referenceNo, setReferenceNo] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const supabase = createClient();

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${organizationId}/${entityType}/${entityId}/${Date.now()}-${safeName}`;

    const { error: upError } = await supabase.storage
      .from("org-documents")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (upError) {
      setUploading(false);
      setError(upError.message);
      return;
    }

    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub as string | undefined;

    // Versioning: mark prior current docs of same type/entity as not current
    const { data: prior } = await supabase
      .from("documents")
      .select("id, version_no")
      .eq("organization_id", organizationId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("doc_type", docType)
      .eq("is_current", true)
      .is("deleted_at", null)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (prior?.version_no ?? 0) + 1;
    if (prior?.id) {
      await supabase
        .from("documents")
        .update({ is_current: false })
        .eq("id", prior.id);
    }

    const { data: row, error: rowError } = await supabase
      .from("documents")
      .insert({
        organization_id: organizationId,
        entity_type: entityType,
        entity_id: entityId,
        doc_type: docType,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        byte_size: file.size,
        reference_no: referenceNo.trim() || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        uploaded_by: userId ?? null,
        version_no: nextVersion,
        supersedes_id: prior?.id ?? null,
        is_current: true,
      })
      .select("id")
      .single();

    setUploading(false);
    if (rowError || !row) {
      setError(rowError?.message ?? "Could not save document row");
      return;
    }

    await logActivity(supabase, {
      organizationId,
      entityType: "document",
      entityId: row.id,
      eventType: "document.uploaded",
      boardId: boardId ?? undefined,
      toValue: { doc_type: docType, file_name: file.name, entity_type: entityType },
    });

    setReferenceNo("");
    setIssueDate("");
    setExpiryDate("");
    router.refresh();
  }

  async function softDelete(id: string) {
    if (!confirm("Remove this document? It will be soft-deleted.")) return;
    setBusyId(id);
    setError(null);
    const supabase = createClient();
    const { error: updError } = await supabase
      .from("documents")
      .update({
        deleted_at: new Date().toISOString(),
        deletion_reason: "removed by user",
      })
      .eq("id", id);
    setBusyId(null);
    if (updError) {
      setError(updError.message);
      return;
    }
    await logActivity(supabase, {
      organizationId,
      entityType: "document",
      entityId: id,
      eventType: "document.soft_deleted",
      boardId: boardId ?? undefined,
      reason: "removed by user",
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          M03 · PDF / images · private per organisation · entity {entityType}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Document type</span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className={inputClass}
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Reference no.</span>
            <input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Issue date</span>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Expiry date</span>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">File</span>
            <input
              type="file"
              accept=".pdf,image/*"
              disabled={uploading}
              onChange={(e) => void onUpload(e.target.files)}
              className="text-sm"
            />
          </label>
        </div>
        {error ? <p className="mt-2 text-sm text-[var(--google-red)]">{error}</p> : null}
        {uploading ? <p className="mt-2 text-sm text-[var(--muted)]">Uploading…</p> : null}
      </div>

      {!documents.length ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
          No documents yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{documentTypeLabel(d.doc_type)}</p>
                <p className="text-xs text-[var(--muted)]">
                  {d.file_name}
                  {d.version_no ? (
                    <span className="ml-2 text-xs text-[var(--muted)]">v{d.version_no}</span>
                  ) : null}
                  {d.reference_no ? ` · ${d.reference_no}` : ""}
                  {d.expiry_date ? ` · exp ${formatIstDate(d.expiry_date)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {d.signedUrl ? (
                  <a
                    href={d.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--primary)] underline"
                  >
                    Open
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => void softDelete(d.id)}
                  className="text-xs text-[var(--google-red)] underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Back-compat wrapper for Board 360 */
export function BoardDocumentsVault({
  organizationId,
  boardId,
  documents,
}: {
  organizationId: string;
  boardId: string;
  documents: VaultDocument[];
}) {
  return (
    <EntityDocumentsVault
      organizationId={organizationId}
      entityType="board"
      entityId={boardId}
      boardId={boardId}
      documents={documents}
      title="Board document vault"
    />
  );
}
