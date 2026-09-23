"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveDigestPrefs(input: {
  organizationId: string;
  inAppEnabled: boolean;
  emailDigestEnabled: boolean;
  digestFrequency: string;
  complianceAlerts: boolean;
  agreementAlerts: boolean;
  incidentAlerts: boolean;
  vacancyAlerts: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_notification_user_prefs", {
    p_organization_id: input.organizationId,
    p_in_app_enabled: input.inAppEnabled,
    p_email_digest_enabled: input.emailDigestEnabled,
    p_digest_frequency: input.digestFrequency,
    p_compliance_alerts: input.complianceAlerts,
    p_agreement_alerts: input.agreementAlerts,
    p_incident_alerts: input.incidentAlerts,
    p_vacancy_alerts: input.vacancyAlerts,
    p_quiet_hours_start: input.quietHoursStart,
    p_quiet_hours_end: input.quietHoursEnd,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/manage/notifications");
  revalidatePath("/manage/settings");
  return { ok: true };
}
