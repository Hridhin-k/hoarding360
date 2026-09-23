import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/domain/permissions";
import type { OrgRole } from "@/lib/domain/status";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .is("deactivated_at", null)
    .limit(1)
    .maybeSingle();

  if (!can(membership?.role as OrgRole | undefined, "reports.export")) {
    return new Response("Forbidden", { status: 403 });
  }

  const [{ data: boards }, { data: agreements }, { data: vacancies }, { data: loss }] =
    await Promise.all([
      supabase
        .from("boards")
        .select("board_code, name, city, lifecycle_status, lat, lng")
        .is("deleted_at", null)
        .order("board_code")
        .limit(2000),
      supabase
        .from("agreements")
        .select("ref_code, status, starts_on, ends_on, value_paise, clients(name)")
        .is("deleted_at", null)
        .limit(2000),
      supabase.from("upcoming_vacancies").select("*").limit(2000),
      supabase.from("vacancy_loss_faces").select("*").limit(1000),
    ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(boards ?? []), "boards");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (agreements ?? []).map((a) => {
        const c = Array.isArray(a.clients) ? a.clients[0] : a.clients;
        return {
          ref_code: a.ref_code,
          client: (c as { name?: string } | null)?.name,
          status: a.status,
          starts_on: a.starts_on,
          ends_on: a.ends_on,
          value_paise: a.value_paise,
        };
      }),
    ),
    "agreements",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(vacancies ?? []),
    "vacancies",
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(loss ?? []), "vacancy_loss");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets.boards!);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="h360-boards.csv"',
      },
    });
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="h360-reports.xlsx"',
    },
  });
}
