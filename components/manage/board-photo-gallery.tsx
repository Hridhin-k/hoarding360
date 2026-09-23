"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { logActivity } from "@/lib/domain/activity";
import { PHOTO_KINDS, type PhotoKind } from "@/lib/domain/board";
import { formatIstDate } from "@/lib/format";

type PhotoRow = {
  id: string;
  kind: string;
  storage_path: string;
  captured_at: string | null;
  is_cover: boolean;
  signedUrl?: string | null;
};

type Props = {
  organizationId: string;
  boardId: string;
  photos: PhotoRow[];
};

export function BoardPhotoGallery({ organizationId, boardId, photos }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<PhotoKind>("day");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${organizationId}/${boardId}/${kind}-${crypto.randomUUID()}.${ext}`;

    const { error: upError } = await supabase.storage
      .from("board-images")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (upError) {
      setUploading(false);
      setError(upError.message);
      return;
    }

    const isFirst = photos.length === 0;
    const { data: photoRow, error: rowError } = await supabase
      .from("board_photos")
      .insert({
        organization_id: organizationId,
        board_id: boardId,
        kind,
        storage_path: path,
        captured_at: new Date().toISOString(),
        is_cover: isFirst,
      })
      .select("id")
      .single();

    setUploading(false);
    if (rowError || !photoRow) {
      setError(rowError?.message ?? "Could not save photo");
      return;
    }

    await logActivity(supabase, {
      organizationId,
      entityType: "board_photo",
      entityId: photoRow.id,
      eventType: "photo.added",
      boardId,
      toValue: { kind },
    });

    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Photo kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as PhotoKind)}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2"
          >
            {PHOTO_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
          {uploading ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => onUpload(e.target.files)}
          />
        </label>
      </div>
      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}

      {!photos.length ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
          No photos yet. Add day, night, and approach shots — capture date shows as last verified.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <figure
              key={p.id}
              className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"
            >
              {p.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.signedUrl}
                  alt={`${p.kind} view`}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-[var(--wash)] text-sm text-[var(--muted)]">
                  Preview unavailable
                </div>
              )}
              <figcaption className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="font-medium capitalize">{p.kind}</span>
                <span className="text-[var(--muted)]">
                  {p.captured_at
                    ? formatIstDate(p.captured_at.slice(0, 10))
                    : "no date"}
                  {p.is_cover ? " · cover" : ""}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
