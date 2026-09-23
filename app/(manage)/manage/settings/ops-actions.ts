"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/domain/authz";

export async function saveOpsSettings(input: {
  organizationId: string;
  prelistingWindowDays: number;
  alertEscalateAfterHours: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireAction("settings.company");
  if (!gate.ok) return { ok: false, error: gate.error };
  const { supabase, userId } = gate;

  const days = Math.min(90, Math.max(0, input.prelistingWindowDays));
  const hours = Math.min(168, Math.max(1, input.alertEscalateAfterHours));

  const { error } = await supabase.from("organization_ops_settings").upsert({
    organization_id: input.organizationId,
    prelisting_window_days: days,
    alert_escalate_after_hours: hours,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/manage/settings");
  revalidatePath("/manage/vacancies");
  return { ok: true };
}

export async function upsertClearanceType(input: {
  organizationId: string;
  id?: string;
  code: string;
  label: string;
  isMandatoryDefault: boolean;
  active: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireAction("compliance.write");
  if (!gate.ok) return { ok: false, error: gate.error };
  const { supabase } = gate;
  const code = input.code.trim().toLowerCase().replace(/\s+/g, "_");
  const label = input.label.trim();
  if (!code || !label) return { ok: false, error: "Code and label required" };

  if (input.id) {
    const { error } = await supabase
      .from("organization_clearance_types")
      .update({
        code,
        label,
        is_mandatory_default: input.isMandatoryDefault,
        active: input.active,
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("organization_clearance_types").insert({
      organization_id: input.organizationId,
      code,
      label,
      is_mandatory_default: input.isMandatoryDefault,
      active: input.active,
    });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/manage/settings");
  revalidatePath("/manage/compliance");
  return { ok: true };
}

export async function saveMemberGeoScope(input: {
  memberId: string;
  cities: string[];
  districts: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireAction("settings.team");
  if (!gate.ok) return { ok: false, error: gate.error };
  const { error } = await gate.supabase
    .from("organization_members")
    .update({
      scoped_cities: input.cities,
      scoped_districts: input.districts,
    })
    .eq("id", input.memberId)
    .eq("organization_id", gate.organizationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/manage/settings");
  return { ok: true };
}
