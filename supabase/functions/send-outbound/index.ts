import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * send-outbound — processes pending SMS / WhatsApp queue.
 *
 * Secrets (Supabase Function secrets on project bzgdutrmehuojindfyxi):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *   TWILIO_WHATSAPP_FROM  (e.g. whatsapp:+14155238886)
 * Optional India SMS:
 *   MSG91_AUTH_KEY, MSG91_SENDER_ID
 *
 * If no provider secrets: messages marked dry_run (safe for template testing).
 * Auth: service role key in Authorization, or authenticated JWT of org member
 *       invoking via supabase.functions.invoke (function then uses service role).
 */

type OutboundRow = {
  id: string;
  organization_id: string;
  channel: "sms" | "whatsapp";
  template_key: string;
  to_e164: string;
  body: string;
  attempts: number;
};

type OrgSettings = {
  dry_run: boolean;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  // Caller may pass user JWT; we always process with service role.
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_pending_outbound_messages",
    { p_limit: 25 },
  );

  if (claimError) {
    return json({ error: claimError.message }, 500);
  }

  const rows = (claimed ?? []) as OutboundRow[];
  if (!rows.length) {
    return json({ processed: 0, sent: 0, dry_run: 0, failed: 0 });
  }

  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";
  const twilioWaFrom = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? "";
  const msg91Key = Deno.env.get("MSG91_AUTH_KEY") ?? "";
  const msg91Sender = Deno.env.get("MSG91_SENDER_ID") ?? "H360IN";

  const hasTwilio = Boolean(twilioSid && twilioToken && twilioFrom);
  const hasMsg91 = Boolean(msg91Key);
  const hasWhatsApp = Boolean(twilioSid && twilioToken && twilioWaFrom);

  let sent = 0;
  let dryRun = 0;
  let failed = 0;

  for (const row of rows) {
    const { data: settings } = await admin
      .from("organization_notify_settings")
      .select("dry_run")
      .eq("organization_id", row.organization_id)
      .maybeSingle();

    const forceDry = (settings as OrgSettings | null)?.dry_run !== false
      || (row.channel === "sms" && !hasTwilio && !hasMsg91)
      || (row.channel === "whatsapp" && !hasWhatsApp)
      || row.channel === "email"; // email provider not wired yet — always dry_run

    try {
      if (forceDry) {
        await admin
          .from("outbound_messages")
          .update({
            status: "dry_run",
            provider: "dry_run",
            provider_message_id: `dry-${row.id}`,
            sent_at: new Date().toISOString(),
            error: null,
          })
          .eq("id", row.id);
        dryRun += 1;
        continue;
      }

      let provider = "";
      let providerId = "";

      if (row.channel === "whatsapp") {
        const result = await sendTwilio(
          twilioSid,
          twilioToken,
          twilioWaFrom.startsWith("whatsapp:")
            ? twilioWaFrom
            : `whatsapp:${twilioWaFrom}`,
          row.to_e164.startsWith("whatsapp:")
            ? row.to_e164
            : `whatsapp:${row.to_e164}`,
          row.body,
        );
        provider = "twilio_whatsapp";
        providerId = result.sid;
      } else if (hasTwilio) {
        const result = await sendTwilio(
          twilioSid,
          twilioToken,
          twilioFrom,
          row.to_e164,
          row.body,
        );
        provider = "twilio_sms";
        providerId = result.sid;
      } else {
        const result = await sendMsg91(msg91Key, msg91Sender, row.to_e164, row.body);
        provider = "msg91";
        providerId = result.id;
      }

      await admin
        .from("outbound_messages")
        .update({
          status: "sent",
          provider,
          provider_message_id: providerId,
          sent_at: new Date().toISOString(),
          error: null,
        })
        .eq("id", row.id);
      sent += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : "send failed";
      await admin
        .from("outbound_messages")
        .update({
          status: "failed",
          error: message.slice(0, 500),
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  return json({
    processed: rows.length,
    sent,
    dry_run: dryRun,
    failed,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendTwilio(
  sid: string,
  token: string,
  from: string,
  to: string,
  body: string,
): Promise<{ sid: string }> {
  const auth = btoa(`${sid}:${token}`);
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message ?? `Twilio HTTP ${res.status}`);
  }
  return { sid: String(data.sid ?? "") };
}

async function sendMsg91(
  authKey: string,
  sender: string,
  toE164: string,
  body: string,
): Promise<{ id: string }> {
  const mobile = toE164.replace(/^\+/, "");
  const res = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      authkey: authKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Template flow preferred in production; fallback simple SMS API:
      // Using sendhttp for plain text until DLT template IDs are registered.
    }),
  });
  // Prefer classic SMS endpoint for plain body until templates approved
  void res;
  const smsRes = await fetch(
    `https://api.msg91.com/api/sendhttp.php?authkey=${encodeURIComponent(authKey)}` +
      `&mobiles=${encodeURIComponent(mobile)}` +
      `&message=${encodeURIComponent(body)}` +
      `&sender=${encodeURIComponent(sender)}` +
      `&route=4&country=91`,
  );
  const text = await smsRes.text();
  if (!smsRes.ok) {
    throw new Error(`MSG91 HTTP ${smsRes.status}: ${text.slice(0, 200)}`);
  }
  return { id: text.slice(0, 64) };
}
