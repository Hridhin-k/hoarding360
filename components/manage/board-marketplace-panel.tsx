"use client";

import { useState, useTransition } from "react";
import {
  saveMarketplaceOrgSettings,
  setFacePublishableAction,
} from "@/app/(manage)/manage/marketplace/actions";

type FaceRow = {
  id: string;
  face_label: string;
  is_publishable: boolean;
  price_on_request: boolean;
  card_rate_paise: number | null;
  market_title: string | null;
  market_blurb: string | null;
  listed?: boolean | null;
};

type OrgSettings = {
  marketplace_enabled: boolean;
  public_display_name: string | null;
  default_price_on_request: boolean;
  accept_enquiries: boolean;
};

type Props = {
  organizationId: string;
  boardId: string;
  orgSettings: OrgSettings | null;
  faces: FaceRow[];
  blockers: string[];
};

export function BoardMarketplacePanel({
  organizationId,
  boardId,
  orgSettings,
  faces,
  blockers,
}: Props) {
  const [enabled, setEnabled] = useState(orgSettings?.marketplace_enabled ?? false);
  const [displayName, setDisplayName] = useState(
    orgSettings?.public_display_name ?? "",
  );
  const [defaultPor, setDefaultPor] = useState(
    orgSettings?.default_price_on_request ?? false,
  );
  const [accept, setAccept] = useState(orgSettings?.accept_enquiries ?? true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveOrg() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await saveMarketplaceOrgSettings({
        organizationId,
        marketplaceEnabled: enabled,
        publicDisplayName: displayName,
        defaultPriceOnRequest: defaultPor,
        acceptEnquiries: accept,
      });
      if (!res.ok) setError(res.error);
      else setMessage("Organisation marketplace settings saved. Projection refreshed.");
    });
  }

  function toggleFace(face: FaceRow, publishable: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await setFacePublishableAction({
        faceId: face.id,
        boardId,
        publishable,
        priceOnRequest: face.price_on_request,
        marketTitle: face.market_title ?? undefined,
        marketBlurb: face.market_blurb ?? undefined,
      });
      if (!res.ok) setError(res.error);
      else {
        setMessage(
          publishable
            ? res.listed
              ? `Face ${face.face_label} listed on Market.`
              : `Face ${face.face_label} marked publishable — enable org marketplace + meet gates to list.`
            : `Face ${face.face_label} unpublished.`,
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted)]">
          M25 · Publishable projection only (no floor rates / client names). Public launch still
          gated by inventory rules.
        </p>
      </div>

      {blockers.length ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--wash)] p-4 text-sm">
          <p className="font-medium">Publish checklist</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-[var(--ok)]">Board gates look ready (GPS, photo, clearance).</p>
      )}

      <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-medium">Organisation marketplace</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Marketplace enabled for this org
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Public display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-md border border-[var(--border)] px-3 py-2"
            placeholder="Shown instead of legal company name"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={defaultPor}
            onChange={(e) => setDefaultPor(e.target.checked)}
          />
          Default price on request
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
          />
          Accept enquiries
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={saveOrg}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save org settings
        </button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Faces</h3>
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {faces.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">Face {f.face_label}</p>
                <p className="text-[var(--muted)]">
                  {f.is_publishable ? "Publishable" : "Not publishable"}
                  {f.listed ? " · Live on Market" : ""}
                  {f.price_on_request ? " · POR" : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggleFace(f, !f.is_publishable)}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-50"
              >
                {f.is_publishable ? "Unpublish" : "Publish face"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
