import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicIncidentForm } from "@/components/market/public-incident-form";

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: board } = await supabase
    .from("boards")
    .select("id, board_code, name, city")
    .eq("qr_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (!board) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">HOARDINGS360</p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight">{board.name}</h1>
      <p className="text-sm text-[var(--muted)]">
        {board.board_code}
        {board.city ? ` · ${board.city}` : ""}
      </p>
      <div className="mt-6">
        <PublicIncidentForm qrToken={token} boardCode={board.board_code} />
      </div>
    </div>
  );
}
