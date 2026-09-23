type Props = {
  lat: number | null;
  lng: number | null;
  name: string;
};

/** Static OSM embed — no API key. Replace with MapLibre later for portfolio map. */
export function BoardLocationMap({ lat, lng, name }: Props) {
  if (lat == null || lng == null) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--wash)] text-sm text-[var(--muted)]">
        No GPS yet — add lat/lng on Edit
      </div>
    );
  }

  const delta = 0.008;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join("%2C");
  const marker = `${lat}%2C${lng}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <iframe
        title={`Map for ${name}`}
        src={src}
        className="h-48 w-full border-0"
        loading="lazy"
      />
      <p className="bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)]">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>
    </div>
  );
}
