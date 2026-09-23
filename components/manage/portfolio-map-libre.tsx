"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Map, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapBoardPin = {
  id: string;
  board_code: string;
  name: string;
  lat: number;
  lng: number;
  lifecycle_status: string;
  occupancy?: string | null;
};

const LIFE_COLOR: Record<string, string> = {
  active: "#34A853",
  draft: "#80868B",
  maintenance: "#FBBC05",
  retired: "#EA4335",
};

type Props = { boards: MapBoardPin[] };

export function PortfolioMapLibre({ boards }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const mid = useMemo(() => {
    if (!boards.length) return { lat: 10.0, lng: 76.3 };
    return {
      lat: boards.reduce((s, b) => s + b.lat, 0) / boards.length,
      lng: boards.reduce((s, b) => s + b.lng, 0) / boards.length,
    };
  }, [boards]);

  useEffect(() => {
    if (!ref.current || !boards.length) return;
    const map = new Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [mid.lng, mid.lat],
      zoom: 10,
    });
    map.addControl(new NavigationControl(), "top-right");

    const markers: Marker[] = [];
    for (const b of boards) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "h-3.5 w-3.5 rounded-full border-2 border-white shadow";
      el.style.background = LIFE_COLOR[b.lifecycle_status] ?? "#4285F4";
      el.title = `${b.board_code} · ${b.name}`;
      el.onclick = () => setSelected(b.id);
      const m = new Marker({ element: el })
        .setLngLat([b.lng, b.lat])
        .addTo(map);
      markers.push(m);
    }

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
    };
  }, [boards, mid.lat, mid.lng]);

  const sel = boards.find((b) => b.id === selected);

  return (
    <div className="space-y-3">
      <div ref={ref} className="h-[420px] w-full overflow-hidden rounded-lg border border-[var(--border)]" />
      <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
        {Object.entries(LIFE_COLOR).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            {k}
          </span>
        ))}
      </div>
      {sel ? (
        <p className="text-sm">
          Selected:{" "}
          <Link href={`/manage/boards/${sel.id}`} className="text-[var(--primary)] underline">
            {sel.board_code} · {sel.name}
          </Link>
          {sel.occupancy ? ` · ${sel.occupancy}` : ""}
        </p>
      ) : null}
    </div>
  );
}
