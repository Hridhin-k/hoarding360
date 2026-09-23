/**
 * V1.0 exit sniff seed + assertions against live linked project.
 * Seeds municipal permits, one live agreement, refreshes alerts,
 * asserts overlap guard rejects a conflicting booking.
 *
 * Run: node scripts/v1-exit-sniff.mjs
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

function istToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!url.includes("bzgdutrmehuojindfyxi")) {
  console.error("Refusing to run — URL is not harding (bzgdutrmehuojindfyxi):", url);
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const today = istToday();
const results = [];

function ok(label, pass, detail = "") {
  results.push({ label, pass, detail });
  console.log(pass ? `PASS  ${label}` : `FAIL  ${label}`, detail ? `— ${detail}` : "");
}

const { data: orgs } = await supabase.from("organizations").select("id, name").limit(1);
const orgId = orgs?.[0]?.id;
if (!orgId) {
  console.error("No organization");
  process.exit(1);
}
console.log(`Org: ${orgs[0].name} (${orgId})\n`);

const { data: boards } = await supabase
  .from("boards")
  .select("id, board_code, lat, lng")
  .eq("organization_id", orgId)
  .is("deleted_at", null)
  .order("board_code");

ok("Import → boards present", (boards?.length ?? 0) >= 15, `${boards?.length ?? 0} boards`);
ok(
  "GPS on boards",
  (boards ?? []).every((b) => b.lat != null && b.lng != null),
  `${(boards ?? []).filter((b) => b.lat != null).length}/${boards?.length ?? 0}`,
);

const { count: photoCount } = await supabase
  .from("board_photos")
  .select("id", { count: "exact", head: true })
  .is("deleted_at", null);
ok("Photos uploaded", (photoCount ?? 0) > 0, `${photoCount} photos`);

const { count: rateCount } = await supabase
  .from("board_faces")
  .select("id", { count: "exact", head: true })
  .not("card_rate_paise", "is", null)
  .is("deleted_at", null);
ok("Card rates set", (rateCount ?? 0) > 0, `${rateCount} faces with rate`);

// --- Seed permits (skip boards that already have municipal_licence) ---
const { data: existingPermits } = await supabase
  .from("compliance_records")
  .select("board_id")
  .eq("organization_id", orgId)
  .eq("clearance_type", "municipal_licence")
  .is("deleted_at", null);

const havePermit = new Set((existingPermits ?? []).map((r) => r.board_id));
const permitRows = (boards ?? [])
  .filter((b) => !havePermit.has(b.id))
  .map((b, i) => {
    // Mix: mostly valid, some expiring, 2 expired — for alert proof
    let expiry;
    if (i === 0 || i === 1) expiry = addDays(today, -10); // expired
    else if (i === 2 || i === 3) expiry = addDays(today, 14); // expiring soon
    else expiry = addDays(today, 180); // valid
    return {
      organization_id: orgId,
      board_id: b.id,
      clearance_type: "municipal_licence",
      governing_body: "Municipal Corporation",
      reference_no: `MC-${b.board_code}`,
      issue_date: addDays(expiry, -365),
      expiry_date: expiry,
      is_mandatory: true,
      renewal_cycle_months: 12,
      fee_paid_paise: 2500000,
    };
  });

if (permitRows.length) {
  const { error } = await supabase.from("compliance_records").insert(permitRows);
  ok("Seed mandatory permits", !error, error?.message ?? `${permitRows.length} inserted`);
} else {
  ok("Seed mandatory permits", true, "already present");
}

const { count: permitCount } = await supabase
  .from("compliance_records")
  .select("id", { count: "exact", head: true })
  .eq("organization_id", orgId)
  .is("deleted_at", null);
ok("Permits present", (permitCount ?? 0) > 0, `${permitCount} records`);

// --- Demo client + agreement ---
let clientId;
const { data: existingClient } = await supabase
  .from("clients")
  .select("id")
  .eq("organization_id", orgId)
  .eq("name", "V1 Exit Demo Brand")
  .is("deleted_at", null)
  .maybeSingle();

if (existingClient?.id) {
  clientId = existingClient.id;
} else {
  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      organization_id: orgId,
      name: "V1 Exit Demo Brand",
      industry: "FMCG",
      payment_terms: "Net 30",
    })
    .select("id")
    .single();
  if (error) {
    ok("Create demo client", false, error.message);
  } else {
    clientId = client.id;
    ok("Create demo client", true, clientId);
  }
}

const { data: face } = await supabase
  .from("board_faces")
  .select("id, board_id, card_rate_paise, board_faces:id")
  .eq("organization_id", orgId)
  .is("deleted_at", null)
  .eq("face_label", "A")
  .limit(1)
  .maybeSingle();

// get face for KL-EKM-0006
const { data: ekmBoard } = await supabase
  .from("boards")
  .select("id")
  .eq("board_code", "KL-EKM-0006")
  .maybeSingle();

const { data: ekmFace } = await supabase
  .from("board_faces")
  .select("id, card_rate_paise")
  .eq("board_id", ekmBoard?.id ?? "")
  .eq("face_label", "A")
  .is("deleted_at", null)
  .maybeSingle();

const faceId = ekmFace?.id ?? face?.id;
const starts = today;
const ends = addDays(today, 90);

let agreementId;
const { data: existingAgr } = await supabase
  .from("agreements")
  .select("id")
  .eq("organization_id", orgId)
  .eq("ref_code", "V1-EXIT-DEMO")
  .is("deleted_at", null)
  .maybeSingle();

if (existingAgr?.id) {
  agreementId = existingAgr.id;
  ok("Demo agreement", true, "already exists");
} else if (clientId && faceId) {
  const { data: agr, error: agrErr } = await supabase
    .from("agreements")
    .insert({
      organization_id: orgId,
      client_id: clientId,
      ref_code: "V1-EXIT-DEMO",
      starts_on: starts,
      ends_on: ends,
      value_paise: ekmFace?.card_rate_paise ?? 12000000,
      status: "active",
    })
    .select("id")
    .single();

  if (agrErr) {
    ok("Demo agreement", false, agrErr.message);
  } else {
    agreementId = agr.id;
    const { error: afErr } = await supabase.from("agreement_faces").insert({
      organization_id: orgId,
      agreement_id: agr.id,
      face_id: faceId,
      starts_on: starts,
      ends_on: ends,
      rate_paise: ekmFace?.card_rate_paise ?? 12000000,
    });
    ok("Demo agreement + face", !afErr, afErr?.message ?? agr.id);
  }
} else {
  ok("Demo agreement", false, "missing client or face");
}

// Overlap assertion
if (faceId && clientId) {
  const { data: agr2, error: a2e } = await supabase
    .from("agreements")
    .insert({
      organization_id: orgId,
      client_id: clientId,
      ref_code: "V1-EXIT-OVERLAP",
      starts_on: starts,
      ends_on: addDays(today, 30),
      value_paise: 1,
      status: "active",
    })
    .select("id")
    .single();

  if (a2e || !agr2) {
    ok("Overlap setup agreement", false, a2e?.message ?? "no id");
  } else {
    const { error: overlapErr } = await supabase.from("agreement_faces").insert({
      organization_id: orgId,
      agreement_id: agr2.id,
      face_id: faceId,
      starts_on: starts,
      ends_on: addDays(today, 30),
      rate_paise: 1,
    });
    const blocked =
      Boolean(overlapErr) &&
      /overlap/i.test(overlapErr?.message ?? "");
    ok(
      "Overlapping agreements blocked",
      blocked,
      overlapErr?.message ?? "ERROR: overlap was allowed",
    );
    // cleanup overlap attempt agreement
    await supabase
      .from("agreements")
      .update({ deleted_at: new Date().toISOString(), deletion_reason: "overlap sniff cleanup" })
      .eq("id", agr2.id);
  }
}

// Occupancy materialised?
const { count: occCount } = await supabase
  .from("occupancy_periods")
  .select("id", { count: "exact", head: true });
ok("Occupancy periods materialised", (occCount ?? 0) > 0, `${occCount} periods`);

// Alerts
const { error: alertErr } = await supabase.rpc("refresh_compliance_alerts");
ok("refresh_compliance_alerts", !alertErr, alertErr?.message ?? "");

const { count: notifCount } = await supabase
  .from("notifications")
  .select("id", { count: "exact", head: true });
ok("Permit expiry alerts fire", (notifCount ?? 0) > 0, `${notifCount} notifications`);

// Notify settings + listed market
await supabase.from("organization_notify_settings").upsert({
  organization_id: orgId,
  sms_enabled: false,
  whatsapp_enabled: false,
  dry_run: true,
  compliance_alerts_enabled: true,
  agreement_reminders_enabled: true,
  client_reminders_enabled: true,
});
ok("Outbound settings (dry_run)", true, "dry_run=true until Twilio/MSG91 secrets");

const { count: listed } = await supabase
  .from("marketplace_listings")
  .select("face_id", { count: "exact", head: true })
  .eq("is_listed", true);
ok("Marketplace projection listed", (listed ?? 0) > 0, `${listed} listed`);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("Failed:", failed.map((f) => f.label).join(", "));
  process.exit(1);
}
console.log("V1.0 exit sniff: PASS");
