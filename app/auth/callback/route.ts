import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/manage";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Email confirm links without next land on verify success
      if (next === "/manage" && searchParams.get("type") === "signup") {
        return NextResponse.redirect(`${origin}/auth/verify`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    if (next.startsWith("/auth/update-password")) {
      return NextResponse.redirect(`${origin}/auth/verify?error=1`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth`);
}
