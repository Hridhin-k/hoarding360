/** M10 board/face CSV import helpers */

export const BOARD_IMPORT_HEADERS = [
  "board_code",
  "name",
  "structure_type",
  "city",
  "district",
  "state",
  "pin_code",
  "address_line",
  "landmark",
  "road_name",
  "lat",
  "lng",
  "face_label",
  "width_ft",
  "height_ft",
  "illumination",
  "facing_direction",
  "card_rate_rupees",
] as const;

export type BoardImportHeader = (typeof BOARD_IMPORT_HEADERS)[number];

export type BoardImportRow = Record<BoardImportHeader, string> & {
  _row: number;
};

export type ValidatedImportRow = BoardImportRow & {
  ok: boolean;
  errors: string[];
  latNum: number | null;
  lngNum: number | null;
  widthNum: number | null;
  heightNum: number | null;
  ratePaise: number | null;
};

export const SAMPLE_IMPORT_CSV = [
  BOARD_IMPORT_HEADERS.join(","),
  "BLR-HSR-0142,HSR Layout Junction,hoarding,Bengaluru,Bengaluru Urban,Karnataka,560102,100 Feet Rd,,100 Feet Road,12.9116,77.6389,A,40,20,frontlit,North,60000",
  "BLR-HSR-0142,HSR Layout Junction,hoarding,Bengaluru,Bengaluru Urban,Karnataka,560102,100 Feet Rd,,100 Feet Road,12.9116,77.6389,B,40,20,frontlit,South,55000",
  "BLR-KOR-0008,Koramangala Signal,unipole,Bengaluru,Bengaluru Urban,Karnataka,560034,,,80 Feet Road,12.9352,77.6245,A,30,15,backlit,East,45000",
].join("\n");

/** Minimal CSV parser — supports quoted fields and commas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    // skip fully empty rows
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushCell();
      continue;
    }
    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  pushCell();
  pushRow();
  return rows;
}

export function rowsToObjects(matrix: string[][]): BoardImportRow[] {
  if (!matrix.length) return [];
  const header = matrix[0].map((h) => h.trim().toLowerCase());
  const index = (name: BoardImportHeader) => header.indexOf(name);

  const missing = BOARD_IMPORT_HEADERS.filter((h) => index(h) < 0);
  if (missing.length) {
    throw new Error(`Missing columns: ${missing.join(", ")}`);
  }

  return matrix.slice(1).map((cells, i) => {
    const get = (name: BoardImportHeader) => {
      const idx = index(name);
      return (cells[idx] ?? "").trim();
    };
    const obj = { _row: i + 2 } as BoardImportRow;
    for (const h of BOARD_IMPORT_HEADERS) {
      obj[h] = get(h);
    }
    return obj;
  });
}

/** Build objects using an explicit source-header → canonical field map. */
export function rowsToObjectsWithMapping(
  matrix: string[][],
  mapping: Partial<Record<BoardImportHeader, string>>,
): BoardImportRow[] {
  if (!matrix.length) return [];
  const header = matrix[0].map((h) => h.trim());
  const headerLower = header.map((h) => h.toLowerCase());

  const required: BoardImportHeader[] = ["board_code", "name", "face_label"];
  for (const r of required) {
    if (!mapping[r]) throw new Error(`Map a column to ${r}`);
  }

  return matrix.slice(1).map((cells, i) => {
    const obj = { _row: i + 2 } as BoardImportRow;
    for (const h of BOARD_IMPORT_HEADERS) {
      const source = mapping[h];
      if (!source) {
        obj[h] = "";
        continue;
      }
      const idx = headerLower.indexOf(source.trim().toLowerCase());
      obj[h] = idx >= 0 ? (cells[idx] ?? "").trim() : "";
    }
    return obj;
  });
}

export function suggestColumnMapping(fileHeaders: string[]): Partial<Record<BoardImportHeader, string>> {
  const map: Partial<Record<BoardImportHeader, string>> = {};
  const lower = fileHeaders.map((h) => ({ raw: h, key: h.trim().toLowerCase().replace(/\s+/g, "_") }));

  const aliases: Record<BoardImportHeader, string[]> = {
    board_code: ["board_code", "code", "board", "structure_code", "hoarding_code"],
    name: ["name", "board_name", "structure_name", "title"],
    structure_type: ["structure_type", "type", "format", "media_type"],
    city: ["city", "town"],
    district: ["district"],
    state: ["state", "province"],
    pin_code: ["pin_code", "pincode", "pin", "zip"],
    address_line: ["address_line", "address", "location"],
    landmark: ["landmark"],
    road_name: ["road_name", "road", "street"],
    lat: ["lat", "latitude"],
    lng: ["lng", "lon", "long", "longitude"],
    face_label: ["face_label", "face", "side", "panel"],
    width_ft: ["width_ft", "width", "w"],
    height_ft: ["height_ft", "height", "h"],
    illumination: ["illumination", "lighting", "lit"],
    facing_direction: ["facing_direction", "facing", "direction"],
    card_rate_rupees: ["card_rate_rupees", "card_rate", "rate", "rate_inr", "monthly_rate"],
  };

  for (const field of BOARD_IMPORT_HEADERS) {
    const exact = lower.find((h) => h.key === field);
    if (exact) {
      map[field] = exact.raw;
      continue;
    }
    const alias = aliases[field].find((a) => lower.some((h) => h.key === a));
    if (alias) {
      const hit = lower.find((h) => h.key === alias);
      if (hit) map[field] = hit.raw;
    }
  }
  return map;
}

export function fileHeadersFromMatrix(matrix: string[][]): string[] {
  if (!matrix.length) return [];
  return matrix[0].map((h) => h.trim()).filter(Boolean);
}

/** Accept 45000, 45,000, ₹45000, 45k */
export function parseMoneyRupees(raw: string): number | null {
  if (!raw.trim()) return null;
  let s = raw.trim().toLowerCase().replace(/[₹,\s]/g, "");
  const k = s.endsWith("k");
  if (k) s = s.slice(0, -1);
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return k ? n * 1000 : n;
}

export function validateImportRows(rows: BoardImportRow[]): ValidatedImportRow[] {
  const seen = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];
    if (!row.board_code) errors.push("board_code required");
    if (!row.name) errors.push("name required");
    if (!row.face_label) errors.push("face_label required");

    const key = `${row.board_code.toUpperCase()}::${row.face_label}`;
    if (row.board_code && row.face_label) {
      if (seen.has(key)) errors.push("duplicate board_code+face_label in file");
      seen.add(key);
    }

    let latNum: number | null = null;
    let lngNum: number | null = null;
    if (row.lat || row.lng) {
      latNum = Number(row.lat);
      lngNum = Number(row.lng);
      if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
        errors.push("lat/lng must be numbers");
        latNum = null;
        lngNum = null;
      } else if (latNum < 6 || latNum > 38 || lngNum < 68 || lngNum > 98) {
        errors.push("coordinates look outside India");
      }
    }

    const widthNum = row.width_ft ? Number(row.width_ft) : null;
    const heightNum = row.height_ft ? Number(row.height_ft) : null;
    if (row.width_ft && Number.isNaN(widthNum)) errors.push("width_ft invalid");
    if (row.height_ft && Number.isNaN(heightNum)) errors.push("height_ft invalid");

    let ratePaise: number | null = null;
    if (row.card_rate_rupees) {
      const rupees = parseMoneyRupees(row.card_rate_rupees);
      if (rupees == null) errors.push("card_rate_rupees invalid");
      else ratePaise = Math.round(rupees * 100);
    }

    const illumination = row.illumination || "nonlit";
    if (
      illumination &&
      !["frontlit", "backlit", "nonlit", "led"].includes(illumination)
    ) {
      errors.push("illumination must be frontlit|backlit|nonlit|led");
    }

    return {
      ...row,
      ok: errors.length === 0,
      errors,
      latNum,
      lngNum,
      widthNum: widthNum != null && !Number.isNaN(widthNum) ? widthNum : null,
      heightNum: heightNum != null && !Number.isNaN(heightNum) ? heightNum : null,
      ratePaise,
    };
  });
}

export function correctionCsv(rows: ValidatedImportRow[]): string {
  const header = [...BOARD_IMPORT_HEADERS, "error"].join(",");
  const lines = rows
    .filter((r) => !r.ok)
    .map((r) => {
      const cells = BOARD_IMPORT_HEADERS.map((h) => csvEscape(r[h]));
      cells.push(csvEscape(r.errors.join("; ")));
      return cells.join(",");
    });
  return [header, ...lines].join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export type BoardGroup = {
  board_code: string;
  name: string;
  structure_type: string;
  city: string;
  district: string;
  state: string;
  pin_code: string;
  address_line: string;
  landmark: string;
  road_name: string;
  lat: number | null;
  lng: number | null;
  faces: Array<{
    face_label: string;
    width_ft: number | null;
    height_ft: number | null;
    illumination: string;
    facing_direction: string;
    card_rate_paise: number | null;
  }>;
};

export function groupValidRows(rows: ValidatedImportRow[]): BoardGroup[] {
  const map = new Map<string, BoardGroup>();
  for (const r of rows.filter((x) => x.ok)) {
    const code = r.board_code.toUpperCase();
    let g = map.get(code);
    if (!g) {
      g = {
        board_code: code,
        name: r.name,
        structure_type: r.structure_type || "hoarding",
        city: r.city,
        district: r.district,
        state: r.state,
        pin_code: r.pin_code,
        address_line: r.address_line,
        landmark: r.landmark,
        road_name: r.road_name,
        lat: r.latNum,
        lng: r.lngNum,
        faces: [],
      };
      map.set(code, g);
    }
    g.faces.push({
      face_label: r.face_label,
      width_ft: r.widthNum,
      height_ft: r.heightNum,
      illumination: r.illumination || "nonlit",
      facing_direction: r.facing_direction,
      card_rate_paise: r.ratePaise,
    });
  }
  return [...map.values()];
}
