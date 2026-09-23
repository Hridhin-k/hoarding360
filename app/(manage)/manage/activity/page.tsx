import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActivityTimeline } from "@/components/manage/activity-timeline";
import { activityLabel, type ActivityEvent } from "@/lib/domain/activity";

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    entity?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("activity_events")
    .select(
      "id, organization_id, actor_id, entity_type, entity_id, event_type, board_id, from_value, to_value, reason, occurred_at",
    )
    .order("occurred_at", { ascending: false })
    .limit(500);

  const actorIds = [
    ...new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean) as string[]),
  ];
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const enriched = ((rows ?? []) as ActivityEvent[]).map((e) => ({
    ...e,
    actor_name: e.actor_id ? nameById.get(e.actor_id) ?? null : null,
  }));

  const q = sp.q?.trim().toLowerCase() ?? "";
  const filtered = enriched.filter((e) => {
    if (sp.entity && e.entity_type !== sp.entity) return false;
    if (q) {
      const hay = [
        e.event_type,
        e.entity_type,
        e.reason ?? "",
        e.actor_name ?? "",
        activityLabel(e.event_type),
        JSON.stringify(e.to_value ?? {}),
        JSON.stringify(e.from_value ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const entityTypes = [
    ...new Set((rows ?? []).map((r) => r.entity_type).filter(Boolean)),
  ].sort();

  const exportHref = `/manage/activity/export?${new URLSearchParams({
    ...(sp.q ? { q: sp.q } : {}),
    ...(sp.entity ? { entity: sp.entity } : {}),
  }).toString()}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-[var(--ink)]">
            Activity log
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            M08 · Org-wide audit trail · {filtered.length} events shown
          </p>
        </div>
        <a
          href={exportHref}
          className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
        >
          Export CSV
        </a>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Search</span>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Event, reason, entity…"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Entity</span>
          <select
            name="entity"
            defaultValue={sp.entity ?? ""}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          >
            <option value="">All</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          Filter
        </button>
        <Link href="/manage/activity" className="text-sm text-[var(--muted)] underline">
          Clear
        </Link>
      </form>

      {error ? (
        <p className="text-sm text-[var(--google-red)]">{error.message}</p>
      ) : (
        <ActivityTimeline
          events={filtered}
          emptyMessage="No activity yet — edits to boards, agreements, and clearances appear here."
        />
      )}
    </div>
  );
}
