"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { fieldBoardPath } from "@/lib/domain/field";

type Props = {
  qrToken: string;
  boardCode: string;
};

export function BoardQrCard({ qrToken, boardCode }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const path = fieldBoardPath(qrToken);
  const fullUrl = origin ? `${origin}${path}` : path;

  useEffect(() => {
    if (!origin) return;
    void QRCode.toDataURL(fullUrl, {
      width: 220,
      margin: 1,
      color: { dark: "#202124", light: "#ffffff" },
    }).then(setDataUrl);
  }, [fullUrl, origin]);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-medium">Field QR · M11</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Scan opens Field on {boardCode}. Token: <code>{qrToken.slice(0, 8)}…</code>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={`QR for ${boardCode}`} className="h-40 w-40 rounded-md border border-[var(--border)]" />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--muted)]">
            Generating…
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p className="break-all text-[var(--muted)]">{fullUrl}</p>
          <a
            href={path}
            className="inline-block text-[var(--accent)] hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Open in Field →
          </a>
          <a
            href={origin ? `${origin}/report/${qrToken}` : `/report/${qrToken}`}
            className="ml-3 inline-block text-[var(--muted)] hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Public report link
          </a>
        </div>
      </div>
    </div>
  );
}
