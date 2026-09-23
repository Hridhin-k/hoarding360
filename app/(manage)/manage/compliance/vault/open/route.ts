import { NextResponse } from "next/server";
import { getManageSession } from "@/lib/supabase/session";

/** Sign one vault file when the user opens it, so the list page does not wait on storage. */
export async function GET(request: Request) {
  const vault = new URL("/manage/compliance/vault", request.url);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.redirect(vault);

  const { supabase, userId } = await getManageSession();
  if (!userId) {
    return NextResponse.redirect(
      new URL("/auth/login?next=/manage/compliance/vault", request.url),
    );
  }

  const { data } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data?.storage_path) return NextResponse.redirect(vault);

  const { data: signed } = await supabase.storage
    .from("org-documents")
    .createSignedUrl(data.storage_path, 60);

  if (!signed?.signedUrl) return NextResponse.redirect(vault);
  return NextResponse.redirect(signed.signedUrl);
}
