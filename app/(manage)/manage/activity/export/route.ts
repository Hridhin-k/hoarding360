import { createClient } from "@/lib/supabase/server";
import { activityLabel } from "@/lib/domain/activity";

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
  return v;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const entity = searchParams.get("entity")?.trim() ?? "";

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("activity_events")
    .select(
      "id, entity_type, entity_id, event_type, board_id, to_value, reason, occurred_at",
    )
    .order("occurred_at", { ascending: false })
    .limit(2000);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const filtered = (rows ?? []).filter((e) => {
    if (entity && e.entity_type !== entity) return false;
    if (q) {
      const hay = [
        e.event_type,
        e.entity_type,
        e.reason ?? "",
        activityLabel(e.event_type),
        JSON.stringify(e.to_value ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const header = [
    "occurred_at_ist",
    "event_type",
    "entity_type",
    "entity_id",
    "board_id",
    "reason",
    "to_value",
  ];
  const lines = [
    header.join(","),
    ...filtered.map((e) =>
      [
        csvEscape(
          new Date(e.occurred_at).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          }),
        ),
        csvEscape(e.event_type),
        csvEscape(e.entity_type),
        csvEscape(e.entity_id),
        csvEscape(e.board_id ?? ""),
        csvEscape(e.reason ?? ""),
        csvEscape(JSON.stringify(e.to_value ?? {})),
      ].join(","),
    ),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="h360-activity-${stamp}.csv"`,
    },
  });
}
