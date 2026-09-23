import Link from "next/link";
import { requireManageSession } from "@/lib/supabase/session";
import {
  CreateIncidentForm,
  IncidentStatusSelect,
} from "@/components/manage/incident-forms";

export default async function IncidentsPage() {
  const { supabase, orgId } = await requireManageSession("/manage/incidents");

  const [{ data: boards }, { data: incidents }] = await Promise.all([
    supabase
      .from("boards")
      .select("id, board_code, name")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("board_code"),
    supabase
      .from("incidents")
      .select(
        "id, title, status, severity, category, created_at, board_id, boards(board_code, name)",
      )
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const open = (incidents ?? []).filter(
    (i) => i.status !== "closed" && i.status !== "resolved",
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-[var(--ink)]">Incidents</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          M11 · {open.length} open · triage from Manage or Field
        </p>
      </div>

      <CreateIncidentForm
        organizationId={orgId}
        boards={(boards ?? []).map((b) => ({
          id: b.id,
          label: `${b.board_code} · ${b.name}`,
        }))}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium">All incidents</h2>
        {!incidents?.length ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
            No incidents yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-white">
            {incidents.map((inc) => {
              const board = Array.isArray(inc.boards) ? inc.boards[0] : inc.boards;
              return (
                <li
                  key={inc.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-[var(--ink)]">{inc.title}</p>
                    <p className="text-xs text-[var(--muted)]">
                      <Link
                        href={`/manage/boards/${inc.board_id}?tab=incidents`}
                        className="text-[var(--primary)] underline"
                      >
                        {(board as { board_code?: string } | null)?.board_code ?? "Board"}
                      </Link>
                      {" · "}
                      {inc.category} · {inc.severity} ·{" "}
                      {new Date(inc.created_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </p>
                  </div>
                  <IncidentStatusSelect incidentId={inc.id} status={inc.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
