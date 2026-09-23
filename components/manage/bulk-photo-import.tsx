"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { logActivity } from "@/lib/domain/activity";

/** M10 · Bulk photos named BOARDCODE_face_kind.jpg */
export function BulkPhotoImport({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function parseName(name: string): { code: string; kind: string } | null {
    const base = name.replace(/\.[^.]+$/, "");
    const parts = base.split(/[_\-]/);
    if (parts.length < 2) return null;
    const code = parts[0]!.toUpperCase();
    const kind = (parts[parts.length - 1] ?? "day").toLowerCase();
    return { code, kind: ["day", "night", "approach", "other"].includes(kind) ? kind : "other" };
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-white p-4">
      <h2 className="text-sm font-medium">Bulk photos by filename</h2>
      <p className="text-xs text-[var(--muted)]">
        M10 · Name files like <code>BLR-HSR-0142_day.jpg</code> · matched to board_code
      </p>
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={pending}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (!files.length) return;
          startTransition(async () => {
            setError(null);
            const lines: string[] = [];
            const supabase = createClient();
            for (const file of files) {
              const parsed = parseName(file.name);
              if (!parsed) {
                lines.push(`Skip ${file.name}: bad name`);
                continue;
              }
              const { data: board } = await supabase
                .from("boards")
                .select("id")
                .eq("organization_id", organizationId)
                .eq("board_code", parsed.code)
                .is("deleted_at", null)
                .maybeSingle();
              if (!board) {
                lines.push(`Skip ${file.name}: board ${parsed.code} not found`);
                continue;
              }
              const path = `${organizationId}/${board.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
              const { error: upError } = await supabase.storage
                .from("board-images")
                .upload(path, file, { contentType: file.type, upsert: false });
              if (upError) {
                lines.push(`${file.name}: ${upError.message}`);
                continue;
              }
              const { error: rowError } = await supabase.from("board_photos").insert({
                organization_id: organizationId,
                board_id: board.id,
                storage_path: path,
                kind: parsed.kind,
                is_cover: false,
              });
              if (rowError) lines.push(`${file.name}: ${rowError.message}`);
              else {
                lines.push(`OK ${parsed.code} · ${parsed.kind}`);
                await logActivity(supabase, {
                  organizationId,
                  entityType: "board",
                  entityId: board.id,
                  eventType: "photo.added",
                  boardId: board.id,
                  toValue: { file: file.name, kind: parsed.kind },
                });
              }
            }
            setLog(lines);
            router.refresh();
          });
        }}
        className="text-sm"
      />
      {error ? <p className="text-sm text-[var(--google-red)]">{error}</p> : null}
      {log.length ? (
        <ul className="max-h-40 overflow-auto text-xs text-[var(--muted)]">
          {log.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
