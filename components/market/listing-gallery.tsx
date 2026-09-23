"use client";

import { useState } from "react";

export type ListingPhoto = {
  kind: string;
  url: string;
};

const KIND_LABEL: Record<string, string> = {
  day: "Day",
  night: "Night",
  approach: "Approach",
  other: "Surroundings",
};

export function ListingGallery({
  title,
  photos,
}: {
  title: string;
  photos: ListingPhoto[];
}) {
  const [active, setActive] = useState(0);
  const current = photos[active];

  if (!current) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center bg-[var(--surface)] text-sm text-[var(--muted)]">
        No photo
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[16/9] bg-[var(--surface)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={`${title} · ${KIND_LABEL[current.kind] ?? current.kind}`} className="h-full w-full object-cover" />
        <span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-[var(--ink)]">
          {KIND_LABEL[current.kind] ?? current.kind} · {active + 1}/{photos.length}
        </span>
      </div>
      {photos.length > 1 ? (
        <div className="grid grid-cols-3 gap-2 p-3">
          {photos.map((photo, i) => (
            <button
              key={`${photo.kind}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`overflow-hidden rounded-md border ${
                i === active ? "border-[var(--accent)]" : "border-transparent"
              }`}
              aria-label={`Show ${KIND_LABEL[photo.kind] ?? photo.kind} photo`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="aspect-[16/10] w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
