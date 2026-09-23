"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type NotifySettingsInput = {
  organizationId: string;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  dryRun: boolean;
  opsMobile: string;
  opsEmail: string;
  complianceAlertsEnabled: boolean;
  agreementRemindersEnabled: boolean;
  clientRemindersEnabled: boolean;
};

export async function saveNotifySettings(
  input: NotifySettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, error: "Not signed in" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("organization_id", input.organizationId)
    .is("deactivated_at", null)
    .maybeSingle();

  if (!membership) return { ok: false, error: "Not a member" };
  if (
    membership.role !== "company_admin" &&
    membership.role !== "operations_manager"
  ) {
    return { ok: false, error: "Only admins/ops can change notify settings" };
  }

  const { error } = await supabase.from("organization_notify_settings").upsert({
    organization_id: input.organizationId,
    sms_enabled: input.smsEnabled,
    whatsapp_enabled: input.whatsappEnabled,
    email_enabled: input.emailEnabled,
    dry_run: input.dryRun,
    ops_mobile: input.opsMobile.trim() || null,
    ops_email: input.opsEmail.trim() || null,
    compliance_alerts_enabled: input.complianceAlertsEnabled,
    agreement_reminders_enabled: input.agreementRemindersEnabled,
    client_reminders_enabled: input.clientRemindersEnabled,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/manage/settings");
  return { ok: true };
}

export async function refreshAndDispatchOutbound(): Promise<
  | { ok: true; refresh: unknown; dispatch: unknown }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in" };

  const { data: refresh, error: refreshError } = await supabase.rpc(
    "refresh_compliance_alerts",
  );
  if (refreshError) return { ok: false, error: refreshError.message };

  const { data: dispatch, error: fnError } = await supabase.functions.invoke(
    "send-outbound",
    { body: {} },
  );

  if (fnError) {
    return {
      ok: false,
      error: `Enqueue ok, but send-outbound failed: ${fnError.message}. Deploy the Edge Function and set secrets.`,
    };
  }

  revalidatePath("/manage/settings");
  revalidatePath("/manage/notifications");
  return { ok: true, refresh, dispatch };
}

export async function enqueueTestOutbound(
  organizationId: string,
  channel: "sms" | "whatsapp",
  mobile: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in" };

  const { data: id, error } = await supabase.rpc("enqueue_outbound_message", {
    p_organization_id: organizationId,
    p_channel: channel,
    p_template_key: "test_ping",
    p_to_raw: mobile,
    p_body:
      "HOARDINGS360 test: messaging pipeline OK. Templates must be approved by provider before production.",
    p_entity_type: "test",
    p_entity_id: null,
  });

  if (error) return { ok: false, error: error.message };
  if (!id) {
    return {
      ok: false,
      error: "Not enqueued — enable the channel and set a valid +91 mobile.",
    };
  }

  const { error: fnError } = await supabase.functions.invoke("send-outbound", {
    body: {},
  });
  if (fnError) {
    return {
      ok: false,
      error: `Queued, but dispatch failed: ${fnError.message}`,
    };
  }

  revalidatePath("/manage/settings");
  return { ok: true };
}
