"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markNotificationRead } from "@/app/(manage)/manage/notifications/actions";
import { kindLabel, priorityTone, type AppNotification } from "@/lib/domain/notifications";

type Props = {
  notification: AppNotification;
};

export function NotificationRow({ notification: n }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unread = !n.read_at;

  function onOpen() {
    startTransition(async () => {
      if (unread) await markNotificationRead(n.id);
      if (n.href) router.push(n.href);
      else router.refresh();
    });
  }

  return (
    <li
      className={`flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0 ${
        unread ? "border-l-2 border-l-[var(--primary)] bg-white" : ""
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={pending}
        className="min-w-0 flex-1 text-left disabled:opacity-60"
      >
        <div className="flex flex-wrap items-center gap-2">
          {unread ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: priorityTone(n.priority) }}
              aria-hidden
            />
          ) : null}
          <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
            {kindLabel(n.kind)}
          </span>
          <span className="text-xs text-[var(--muted)]">
            {new Date(n.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          </span>
          {n.escalated_at ? (
            <span className="rounded border border-[var(--google-red)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--google-red)]">
              Escalated
            </span>
          ) : null}
        </div>
        <p className="mt-1 font-medium text-[var(--ink)]">{n.title}</p>
        {n.body ? <p className="mt-0.5 text-sm text-[var(--muted)]">{n.body}</p> : null}
      </button>
      {n.href ? (
        <Link
          href={n.href}
          onClick={() => {
            if (unread) void markNotificationRead(n.id);
          }}
          className="shrink-0 text-sm text-[var(--accent)] hover:underline"
        >
          Open
        </Link>
      ) : null}
    </li>
  );
}
