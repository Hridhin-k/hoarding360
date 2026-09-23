"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveMarketplaceOrgSettings(input: {
  organizationId: string;
  marketplaceEnabled: boolean;
  publicDisplayName: string;
  defaultPriceOnRequest: boolean;
  acceptEnquiries: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, error: "Not signed in" };

  const { error } = await supabase.from("organization_marketplace_settings").upsert({
    organization_id: input.organizationId,
    marketplace_enabled: input.marketplaceEnabled,
    public_display_name: input.publicDisplayName.trim() || null,
    default_price_on_request: input.defaultPriceOnRequest,
    accept_enquiries: input.acceptEnquiries,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });

  if (error) return { ok: false, error: error.message };

  await supabase.rpc("refresh_all_marketplace_listings");
  revalidatePath("/manage");
  revalidatePath("/boards");
  return { ok: true };
}

export async function setFacePublishableAction(input: {
  faceId: string;
  publishable: boolean;
  priceOnRequest?: boolean;
  marketTitle?: string;
  marketBlurb?: string;
  boardId: string;
}): Promise<{ ok: true; listed?: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_face_publishable", {
    p_face_id: input.faceId,
    p_publishable: input.publishable,
    p_price_on_request: input.priceOnRequest ?? null,
    p_market_title: input.marketTitle ?? null,
    p_market_blurb: input.marketBlurb ?? null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/manage/boards/${input.boardId}`);
  revalidatePath("/boards");
  const listed =
    data && typeof data === "object" && "listed" in data
      ? Boolean((data as { listed: boolean }).listed)
      : undefined;
  return { ok: true, listed };
}
