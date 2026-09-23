"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { classifyDocFromFilename, DOCUMENT_TYPES } from "@/lib/domain/documents";
import { logActivity } from "@/lib/domain/activity";

type Props = {
  organizationId: string;
  boards: { id: string; board_code: string; name: string }[];
};

export function BulkDocUpload({ organizationId, boards }: Props) {
  const router = useRouter();
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-3 rounded-lg border border-[var(--border)] bg-white p-4">
      <div>
        <h2 className="text-sm font-medium">Bulk document upload</h2>
        <p className="text-xs text-[var(--muted)]">
          P2 · Filename auto-classify · attaches to selected board
        </p>
      </div>
      <select
        value={boardId}
        onChange={(e) => setBoardId(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
      >
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            {b.board_code} · {b.name}
          </option>
        ))}
      </select>
      <input
        type="file"
        multiple
        accept=".pdf,image/*"
        disabled={pending || !boardId}
        onChange={(e) => {
          const files = e.target.files;
          if (!files?.length || !boardId) return;
          startTransition(async () => {
            setError(null);
            setMessage(null);
            const supabase = createClient();
            let ok = 0;
            for (const file of Array.from(files)) {
              const docType = classifyDocFromFilename(file.name);
              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
              const path = `${organizationId}/board/${boardId}/${Date.now()}-${safeName}`;
              const { error: upError } = await supabase.storage
                .from("org-documents")
                .upload(path, file, { contentType: file.type, upsert: false });
              if (upError) {
                setError(upError.message);
                continue;
              }
              const { data: prior } = await supabase
                .from("documents")
                .select("id, version_no")
                .eq("organization_id", organizationId)
                .eq("entity_type", "board")
                .eq("entity_id", boardId)
                .eq("doc_type", docType)
                .eq("is_current", true)
                .is("deleted_at", null)
                .order("version_no", { ascending: false })
                .limit(1)
                .maybeSingle();
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
                  entity_type: "board",
                  entity_id: boardId,
                  doc_type: docType,
                  file_name: file.name,
                  storage_path: path,
                  mime_type: file.type || null,
                  byte_size: file.size,
                  version_no: (prior?.version_no ?? 0) + 1,
                  supersedes_id: prior?.id ?? null,
                  is_current: true,
                })
                .select("id")
                .single();
              if (rowError || !row) {
                setError(rowError?.message ?? "Insert failed");
                continue;
              }
              await logActivity(supabase, {
                organizationId,
                entityType: "document",
                entityId: row.id,
                eventType: "document.uploaded",
                boardId,
                toValue: {
                  doc_type: docType,
                  file_name: file.name,
                  auto_classified: true,
                },
              });
              ok += 1;
            }
            setMessage(
              `Uploaded ${ok} file(s). Types: ${DOCUMENT_TYPES.map((d) => d.value).join(", ")} matched by name.`,
            );
            router.refresh();
          });
        }}
        className="block w-full text-sm"
      />
      {error ? <p className="text-sm text-[var(--google-red)]">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--google-green)]">{message}</p> : null}
    </section>
  );
}
