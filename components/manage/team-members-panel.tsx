"use client";

import { useState, useTransition } from "react";
import {
  inviteTeamMember,
  setMemberActive,
  updateMemberRole,
} from "@/app/(manage)/manage/settings/team-actions";
import { saveMemberGeoScope } from "@/app/(manage)/manage/settings/ops-actions";
import { ORG_ROLES, type OrgRole } from "@/lib/domain/status";

const inputClass =
  "rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]";

export type TeamMemberRow = {
  id: string;
  user_id: string;
  role: string;
  deactivated_at: string | null;
  email: string | null;
  full_name: string | null;
  scoped_cities?: string[] | null;
  scoped_districts?: string[] | null;
};

type Props = {
  organizationId: string;
  members: TeamMemberRow[];
  invites: { id: string; email: string; role: string; status: string; created_at: string }[];
};

export function TeamMembersPanel({ organizationId, members, invites }: Props) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<OrgRole>("sales_executive");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [geoDraft, setGeoDraft] = useState<Record<string, { cities: string; districts: string }>>(
    {},
  );

  function onInvite() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await inviteTeamMember({
        organizationId,
        email,
        role,
        fullName,
      });
      if (!res.ok) setError(res.error);
      else {
        setMessage(res.message);
        setEmail("");
        setFullName("");
      }
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-[var(--border)] bg-white p-4">
      <div>
        <h2 className="text-sm font-medium text-[var(--ink)]">Team</h2>
        <p className="text-xs text-[var(--muted)]">
          M01 · Invite by role · P2 geo scope for field supervisors
        </p>
      </div>

      <div className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 sm:grid-cols-4">
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as OrgRole)}
          className={inputClass}
        >
          {ORG_ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !email}
          onClick={onInvite}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Invite
        </button>
      </div>

      {error ? <p className="text-sm text-[var(--google-red)]">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--google-green)]">{message}</p> : null}

      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-md border border-[var(--border)]">
        {members.map((m) => {
          const draft = geoDraft[m.id] ?? {
            cities: (m.scoped_cities ?? []).join(", "),
            districts: (m.scoped_districts ?? []).join(", "),
          };
          return (
            <li key={m.id} className="space-y-2 px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--ink)]">
                    {m.full_name || m.email || m.user_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {m.email ?? "—"}
                    {m.deactivated_at ? " · deactivated" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={m.role}
                    disabled={pending || Boolean(m.deactivated_at)}
                    onChange={(e) =>
                      startTransition(async () => {
                        await updateMemberRole({
                          organizationId,
                          memberId: m.id,
                          role: e.target.value as OrgRole,
                        });
                      })
                    }
                    className={inputClass}
                  >
                    {ORG_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await setMemberActive({
                          organizationId,
                          memberId: m.id,
                          active: Boolean(m.deactivated_at),
                        });
                      })
                    }
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-xs hover:bg-[var(--wash)]"
                  >
                    {m.deactivated_at ? "Reactivate" : "Deactivate"}
                  </button>
                </div>
              </div>
              {m.role === "field_supervisor" ? (
                <div className="grid gap-2 rounded-md bg-[var(--surface)] p-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    placeholder="Cities (comma-separated)"
                    value={draft.cities}
                    onChange={(e) =>
                      setGeoDraft((d) => ({
                        ...d,
                        [m.id]: { ...draft, cities: e.target.value },
                      }))
                    }
                    className={inputClass}
                  />
                  <input
                    placeholder="Districts (comma-separated)"
                    value={draft.districts}
                    onChange={(e) =>
                      setGeoDraft((d) => ({
                        ...d,
                        [m.id]: { ...draft, districts: e.target.value },
                      }))
                    }
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const cities = draft.cities
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const districts = draft.districts
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const res = await saveMemberGeoScope({
                          memberId: m.id,
                          cities,
                          districts,
                        });
                        if (!res.ok) setError(res.error);
                        else setMessage("Geo scope saved.");
                      })
                    }
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-xs"
                  >
                    Save scope
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {invites.length ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Pending invites
          </p>
          <ul className="space-y-1 text-sm text-[var(--muted)]">
            {invites.map((i) => (
              <li key={i.id}>
                {i.email} · {i.role.replace(/_/g, " ")} · {i.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
