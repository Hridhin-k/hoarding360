/**
 * Demo seed: 3 place photos per Kerala board, from Wikimedia Commons.
 * Uploads into board-images and refreshes marketplace covers.
 * Run: node scripts/seed-kerala-demo-photos.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return env;
}

/** [kind, commons filename] — day is the cover */
const PHOTOS = {
  "KL-TVM-0001": [
    ["day", "Thiruvananthapuram Secretariat skyline.jpg"],
    ["approach", "Jazeera infront of Kerala Secretariat Thiruvananthapuram IMG 4562.JPG"],
    ["other", "Kerala Government Secretariat, Thiruvananthapuram, Kerala, India.jpg"],
  ],
  "KL-TVM-0002": [
    ["day", "Aerial view of Technopark Phase I at Trivandrum India.jpg"],
    ["approach", "Thiruvananthapuram Technopark skyline.jpg"],
    ["other", "Technopark Trivandrum Ariel View June 2014.jpg"],
  ],
  "KL-KLM-0003": [
    ["day", "Chinnakada Roundabout, Kollam.jpg"],
    ["approach", "Aerial view of Chinnakada in 2008.jpg"],
    ["other", "Kollam clocktower.jpg"],
  ],
  "KL-ALP-0004": [
    ["day", "Alappuzha Beach.jpg"],
    ["approach", "Alleppey beach.jpg"],
    ["other", "Alappuzha Boat Jetty.jpg"],
  ],
  "KL-KTM-0005": [
    ["day", "Kottayam Railway Station.jpg"],
    ["approach", "Thirunakkara Mahadeva Temple.jpg"],
    ["other", "Kottayam town.jpg"],
  ],
  "KL-EKM-0006": [
    ["day", "Kochi metro train at mg road station Ernakulam, Kerala, India.jpg"],
    ["approach", "Metro train at kochi metro mg road station Ernakulam, Kerala, India.jpg"],
    ["other", "MG Road metro station Kochi.jpg"],
  ],
  "KL-EKM-0007": [
    ["day", "Edappally road, near LuLu Mall.jpg"],
    ["approach", "LuLu Mall Kochi.jpg"],
    ["other", "Lulu Mall Edappally.jpg"],
  ],
  "KL-EKM-0008": [
    ["day", "Vyttila Mobility Hub, Kochi.jpg"],
    ["approach", "Vyttila junction NHAI sign board.jpg"],
    ["other", "Vyttila sign board.jpg"],
  ],
  "KL-TSR-0009": [
    ["day", "Swaraj Round, Thrissur.jpg"],
    ["approach", "Vadakkunnathan Temple, Thrissur.jpg"],
    ["other", "Vadakkunnathan Temple Thrissur BN3Q3984.jpg"],
  ],
  "KL-TSR-0010": [
    ["day", "Thrissur Railway Station-Kerala - Vijayanrajapuram 01.jpg"],
    ["approach", "Thrissur Railway Station-Kerala - Vijayanrajapuram 02.jpg"],
    ["other", "Thrissur railway station2014.jpg"],
  ],
  "KL-PKD-0011": [
    ["day", "Palakkad Fort.jpg"],
    ["approach", "Palakkad.jpg"],
    ["other", "Palakkad Fort entrance.jpg"],
  ],
  "KL-MLP-0012": [
    ["day", "Kottakkal town.jpg"],
    ["approach", "Kottakkawebsite 001.jpg"],
    ["other", "Kottakkal.jpg"],
  ],
  "KL-KKD-0013": [
    ["day", "Kozhikode Beach.jpg"],
    ["approach", "Kozhikode Beach 2.jpg"],
    ["other", "Mananchira Square.jpg"],
  ],
  "KL-KKD-0014": [
    ["day", "Ramanattukara Bus Station2.jpg"],
    ["approach", "Ramanattukara Surabhi.jpg"],
    ["other", "Ramanattukara.jpg"],
  ],
  "KL-KNR-0015": [
    ["day", "Evening at Payyambalam beach walkway, Kannur.jpg"],
    ["approach", "Payyambalam beach, Kannur.jpg"],
    ["night", "Kannur City.jpg"],
  ],
};

const FALLBACKS = [
  "Alappuzha Beach.jpg",
  "Kozhikode Beach.jpg",
  "Swaraj Round, Thrissur.jpg",
  "Chinnakada Roundabout, Kollam.jpg",
  "Vyttila Mobility Hub, Kochi.jpg",
  "Kannur City.jpg",
];

async function downloadCommons(filename) {
  const url =
    "https://commons.wikimedia.org/wiki/Special:FilePath/" +
    encodeURIComponent(filename) +
    "?width=1600";
  let res;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "HOARDINGS360-demo/1.0 (local demo seed)" },
    });
    if (res.status !== 429 && res.status !== 503) break;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  if (!res.ok) throw new Error(`${res.status} ${filename}`);
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error(`not image ${filename} ${type}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 8000) throw new Error(`too small ${filename}`);
  if (buf.length > 9_500_000) throw new Error(`too large ${filename}`);
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  return { buf, type: type.split(";")[0], ext };
}

async function downloadWithFallback(filename, used) {
  const names = [filename, ...FALLBACKS.filter((f) => !used.has(f))];
  let last = null;
  for (const name of names) {
    try {
      const file = await downloadCommons(name);
      used.add(name);
      return { ...file, source: name };
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw last;
}

const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: boards, error: boardError } = await admin
  .from("boards")
  .select("id, board_code, organization_id, name")
  .is("deleted_at", null)
  .in("board_code", Object.keys(PHOTOS));

if (boardError) throw boardError;

let uploaded = 0;
for (const board of boards ?? []) {
  const shots = PHOTOS[board.board_code];
  if (!shots) continue;

  const { data: existing } = await admin
    .from("board_photos")
    .select("kind")
    .eq("board_id", board.id)
    .is("deleted_at", null);
  const have = new Set((existing ?? []).map((row) => row.kind));

  const used = new Set();
  for (const [index, [kind, filename]] of shots.entries()) {
    if (have.has(kind)) continue;
    await new Promise((r) => setTimeout(r, 700));
    const file = await downloadWithFallback(filename, used);
    const path = `${board.organization_id}/${board.id}/demo-${kind}-${index}.${file.ext}`;
    const { error: upError } = await admin.storage.from("board-images").upload(path, file.buf, {
      contentType: file.type,
      upsert: true,
    });
    if (upError) throw new Error(`${board.board_code} upload ${upError.message}`);

    const { error: rowError } = await admin.from("board_photos").insert({
      organization_id: board.organization_id,
      board_id: board.id,
      kind,
      storage_path: path,
      captured_at: new Date().toISOString(),
      is_cover: index === 0,
    });
    if (rowError) throw new Error(`${board.board_code} row ${rowError.message}`);
    uploaded += 1;
    console.log("ok", board.board_code, kind, file.source);
  }
}

const { data: refreshed, error: refreshError } = await admin.rpc(
  "refresh_all_marketplace_listings",
);
if (refreshError) console.error("refresh", refreshError.message);
else console.log("refreshed listings", refreshed);
console.log("uploaded", uploaded);
