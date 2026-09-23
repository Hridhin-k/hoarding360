import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { PROOF_GEO_RADIUS_M } from "@/lib/domain/field";

export type ProofPackOrg = {
  name: string;
  brand_primary?: string | null;
};

export type ProofPackBoard = {
  board_code: string;
  name: string;
  city: string | null;
  road_name: string | null;
  address_line: string | null;
  lat: number | null;
  lng: number | null;
};

export type ProofPackItem = {
  id: string;
  captured_at: string;
  geo_ok: boolean;
  distance_m: number | null;
  lat: number;
  lng: number;
  notes: string | null;
  photoBytes?: Uint8Array | null;
  photoMime?: string | null;
};

function parseHex(hex: string | null | undefined) {
  const raw = (hex ?? "#1c7a6b").replace("#", "");
  if (raw.length !== 6) return rgb(0.11, 0.48, 0.42);
  const n = parseInt(raw, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function drawFooter(
  page: PDFPage,
  font: PDFFont,
  pageNo: number,
  pageCount: number,
) {
  const { width } = page.getSize();
  page.drawText(
    `HOARDINGS360 · Proof of Display pack · Page ${pageNo} of ${pageCount}`,
    {
      x: 48,
      y: 28,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
    },
  );
  page.drawText("Confidential — for client verification", {
    x: width - 200,
    y: 28,
    size: 8,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
}

/**
 * Branded multi-page PDF: cover + one page per proof (photo + geo).
 * M12 / V1.1 exit criterion.
 */
export async function generateProofPackPdf(input: {
  org: ProofPackOrg;
  board: ProofPackBoard;
  proofs: ProofPackItem[];
  generatedAt?: Date;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = parseHex(input.org.brand_primary);
  const ink = rgb(0.11, 0.1, 0.08);
  const muted = rgb(0.4, 0.38, 0.35);
  const generatedAt = input.generatedAt ?? new Date();
  const istStamp = generatedAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Cover
  {
    const page = doc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    page.drawRectangle({
      x: 0,
      y: height - 120,
      width,
      height: 120,
      color: accent,
    });
    page.drawText("HOARDINGS360", {
      x: 48,
      y: height - 55,
      size: 22,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("Proof of Display pack", {
      x: 48,
      y: height - 82,
      size: 12,
      font,
      color: rgb(0.92, 0.96, 0.95),
    });

    page.drawText(input.org.name, {
      x: 48,
      y: height - 170,
      size: 16,
      font: fontBold,
      color: ink,
    });
    page.drawText("Prepared for client verification", {
      x: 48,
      y: height - 190,
      size: 10,
      font,
      color: muted,
    });

    const lines = [
      `Board code: ${input.board.board_code}`,
      `Name: ${input.board.name}`,
      `Location: ${[input.board.road_name, input.board.address_line, input.board.city].filter(Boolean).join(", ") || "—"}`,
      input.board.lat != null && input.board.lng != null
        ? `GPS: ${input.board.lat.toFixed(5)}, ${input.board.lng.toFixed(5)}`
        : "GPS: not set on structure",
      `Proofs in pack: ${input.proofs.length}`,
      `Geo rule: capture within ${PROOF_GEO_RADIUS_M} m of structure`,
      `Generated (IST): ${istStamp}`,
    ];

    let y = height - 240;
    for (const line of lines) {
      page.drawText(line, { x: 48, y, size: 11, font, color: ink });
      y -= 22;
    }

    page.drawText(
      "Each following page is one field capture with geo distance and photo.",
      {
        x: 48,
        y: 80,
        size: 9,
        font,
        color: muted,
      },
    );
  }

  for (const proof of input.proofs) {
    const page = doc.addPage([595, 842]);
    const { width, height } = page.getSize();

    page.drawText(input.board.board_code, {
      x: 48,
      y: height - 48,
      size: 10,
      font,
      color: muted,
    });
    page.drawText("Proof of Display", {
      x: 48,
      y: height - 72,
      size: 16,
      font: fontBold,
      color: ink,
    });

    const capturedIst = new Date(proof.captured_at).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    const geoLabel = proof.geo_ok
      ? `PASS · ${proof.distance_m != null ? `${Math.round(proof.distance_m)} m` : "within radius"}`
      : `FAIL · ${proof.distance_m != null ? `${Math.round(proof.distance_m)} m` : "unknown"} (limit ${PROOF_GEO_RADIUS_M} m)`;

    const meta = [
      `Captured (IST): ${capturedIst}`,
      `Geo check: ${geoLabel}`,
      `Capture GPS: ${proof.lat.toFixed(5)}, ${proof.lng.toFixed(5)}`,
      proof.notes ? `Notes: ${proof.notes}` : null,
    ].filter(Boolean) as string[];

    let y = height - 110;
    for (const line of meta) {
      page.drawText(line.slice(0, 100), { x: 48, y, size: 10, font, color: ink });
      y -= 18;
    }

    page.drawRectangle({
      x: 48,
      y: y - 8,
      width: 80,
      height: 18,
      color: proof.geo_ok ? rgb(0.18, 0.42, 0.23) : rgb(0.64, 0.23, 0.17),
    });
    page.drawText(proof.geo_ok ? "GEO OK" : "GEO FAIL", {
      x: 58,
      y: y - 3,
      size: 9,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    if (proof.photoBytes && proof.photoBytes.length > 0) {
      try {
        const mime = proof.photoMime ?? "";
        const image =
          mime.includes("png")
            ? await doc.embedPng(proof.photoBytes)
            : await doc.embedJpg(proof.photoBytes);
        const maxW = width - 96;
        const maxH = 420;
        const scale = Math.min(maxW / image.width, maxH / image.height, 1);
        const w = image.width * scale;
        const h = image.height * scale;
        page.drawImage(image, {
          x: 48,
          y: 70,
          width: w,
          height: h,
        });
      } catch {
        page.drawText("(Photo could not be embedded)", {
          x: 48,
          y: 200,
          size: 10,
          font,
          color: muted,
        });
      }
    } else {
      page.drawText("(No photo attached)", {
        x: 48,
        y: 200,
        size: 10,
        font,
        color: muted,
      });
    }
  }

  const pages = doc.getPages();
  pages.forEach((page, i) => {
    drawFooter(page, font, i + 1, pages.length);
  });

  return doc.save();
}
