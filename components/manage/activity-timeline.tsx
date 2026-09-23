import { activityLabel, type ActivityEvent } from "@/lib/domain/activity";

type Props = {
  events: ActivityEvent[];
  emptyMessage?: string;
};

export function ActivityTimeline({
  events,
  emptyMessage = "No activity recorded yet.",
}: Props) {
  if (!events.length) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className="relative ml-2 space-y-0 border-l border-[var(--border)]">
      {events.map((e) => {
        const detail = summarize(e);
        return (
          <li key={e.id} className="relative pb-6 pl-6 last:pb-0">
            <span
              className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-[var(--surface)] bg-[var(--accent)]"
              aria-hidden
            />
            <p className="text-sm font-medium text-[var(--ink)]">
              {activityLabel(e.event_type)}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {new Date(e.occurred_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}
              {e.actor_name
                ? ` · ${e.actor_name}`
                : e.actor_id
                  ? ` · actor ${e.actor_id.slice(0, 8)}`
                  : " · system"}
              {e.entity_type ? ` · ${e.entity_type}` : ""}
              {e.reason ? ` · why: ${e.reason}` : ""}
            </p>
            {(e.from_value || e.to_value) && (
              <div className="mt-2 grid gap-1 rounded-md border border-[var(--border)] bg-[var(--wash)] p-2 text-xs text-[var(--muted)] sm:grid-cols-2">
                <div>
                  <p className="font-medium text-[var(--ink)]">From</p>
                  <pre className="mt-0.5 whitespace-pre-wrap break-all">
                    {e.from_value ? JSON.stringify(e.from_value, null, 0) : "—"}
                  </pre>
                </div>
                <div>
                  <p className="font-medium text-[var(--ink)]">To</p>
                  <pre className="mt-0.5 whitespace-pre-wrap break-all">
                    {e.to_value ? JSON.stringify(e.to_value, null, 0) : "—"}
                  </pre>
                </div>
              </div>
            )}
            {detail && !e.from_value && !e.to_value ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function summarize(e: ActivityEvent): string | null {
  const to = e.to_value;
  if (!to || typeof to !== "object") return null;
  const parts: string[] = [];
  if (typeof to.board_code === "string") parts.push(to.board_code);
  if (typeof to.name === "string") parts.push(to.name);
  if (typeof to.clearance_type === "string") parts.push(to.clearance_type);
  if (typeof to.status === "string") parts.push(String(to.status));
  if (typeof to.ref_code === "string") parts.push(to.ref_code);
  if (typeof to.face_label === "string") parts.push(`Face ${to.face_label}`);
  if (typeof to.boards_created === "number") {
    parts.push(`${to.boards_created} boards · ${to.faces_created ?? 0} faces`);
  }
  return parts.length ? parts.join(" · ") : null;
}
