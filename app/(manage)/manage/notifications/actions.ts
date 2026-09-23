"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function refreshAlerts(
  _formData?: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  void _formData;
  const supabase = await createClient();
  const { error } = await supabase.rpc("refresh_compliance_alerts");
  if (error) return { ok: false, error: error.message };
  await supabase.rpc("escalate_stale_critical_alerts");
  revalidatePath("/manage");
  revalidatePath("/manage/notifications");
  revalidatePath("/manage/compliance");
  return { ok: true };
}

export async function refreshAlertsForm(_formData: FormData): Promise<void> {
  await refreshAlerts(_formData);
}

export async function markNotificationRead(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/manage");
  revalidatePath("/manage/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead(
  _formData?: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  void _formData;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/manage");
  revalidatePath("/manage/notifications");
  return { ok: true };
}

export async function markAllNotificationsReadForm(_formData: FormData): Promise<void> {
  await markAllNotificationsRead(_formData);
}
