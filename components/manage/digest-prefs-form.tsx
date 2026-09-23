"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/pending-button";
import { saveDigestPrefs } from "@/app/(manage)/manage/notifications/prefs-actions";

export type DigestPrefs = {
  in_app_enabled: boolean;
  email_digest_enabled: boolean;
  digest_frequency: "off" | "daily" | "weekly";
  compliance_alerts: boolean;
  agreement_alerts: boolean;
  incident_alerts: boolean;
  vacancy_alerts: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
};

type Props = {
  organizationId: string;
  initial: DigestPrefs | null;
};

export function DigestPrefsForm({ organizationId, initial }: Props) {
  const [inApp, setInApp] = useState(initial?.in_app_enabled ?? true);
  const [emailDigest, setEmailDigest] = useState(initial?.email_digest_enabled ?? true);
  const [freq, setFreq] = useState(initial?.digest_frequency ?? "daily");
  const [compliance, setCompliance] = useState(initial?.compliance_alerts ?? true);
  const [agreements, setAgreements] = useState(initial?.agreement_alerts ?? true);
  const [incidents, setIncidents] = useState(initial?.incident_alerts ?? true);
  const [vacancy, setVacancy] = useState(initial?.vacancy_alerts ?? true);
  const [quietStart, setQuietStart] = useState(
    initial?.quiet_hours_start != null ? String(initial.quiet_hours_start) : "",
  );
  const [quietEnd, setQuietEnd] = useState(
    initial?.quiet_hours_end != null ? String(initial.quiet_hours_end) : "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border)] bg-white p-4">
      <div>
        <h2 className="text-sm font-medium">My alert preferences</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          M07 · Per-user digest rules · email delivery still deferred until provider is wired
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={inApp} onChange={(e) => setInApp(e.target.checked)} />
        In-app alerts
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={emailDigest}
          onChange={(e) => setEmailDigest(e.target.checked)}
        />
        Email digest (when email is enabled org-wide)
      </label>

      <label className="grid max-w-xs gap-1 text-sm">
        <span className="text-[var(--muted)]">Digest frequency</span>
        <select
          value={freq}
          onChange={(e) => setFreq(e.target.value as DigestPrefs["digest_frequency"])}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        >
          <option value="off">Off</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["Compliance / permits", compliance, setCompliance],
            ["Agreement endings", agreements, setAgreements],
            ["Incidents", incidents, setIncidents],
            ["Vacancies", vacancy, setVacancy],
          ] as const
        ).map(([label, val, set]) => (
          <label key={label} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => set(e.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Quiet hours start (0–23 IST)</span>
          <input
            type="number"
            min={0}
            max={23}
            value={quietStart}
            onChange={(e) => setQuietStart(e.target.value)}
            placeholder="e.g. 22"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Quiet hours end</span>
          <input
            type="number"
            min={0}
            max={23}
            value={quietEnd}
            onChange={(e) => setQuietEnd(e.target.value)}
            placeholder="e.g. 7"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-[var(--google-red)]">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--google-green)]">{message}</p> : null}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            setMessage(null);
            const res = await saveDigestPrefs({
              organizationId,
              inAppEnabled: inApp,
              emailDigestEnabled: emailDigest,
              digestFrequency: freq,
              complianceAlerts: compliance,
              agreementAlerts: agreements,
              incidentAlerts: incidents,
              vacancyAlerts: vacancy,
              quietHoursStart: quietStart === "" ? null : Number(quietStart),
              quietHoursEnd: quietEnd === "" ? null : Number(quietEnd),
            });
            if (!res.ok) setError(res.error);
            else setMessage("Preferences saved.");
          })
        }
        className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <Spinner /> : null}{pending ? "Saving…" : "Save my preferences"}
      </button>
    </div>
  );
}
