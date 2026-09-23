"use client";

import { useState, useTransition } from "react";
import {
  enqueueTestOutbound,
  refreshAndDispatchOutbound,
  saveNotifySettings,
} from "@/app/(manage)/manage/settings/actions";

type Settings = {
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  dry_run: boolean;
  ops_mobile: string | null;
  ops_email: string | null;
  compliance_alerts_enabled: boolean;
  agreement_reminders_enabled: boolean;
  client_reminders_enabled: boolean;
};

type MessageRow = {
  id: string;
  channel: string;
  template_key: string;
  to_e164: string;
  status: string;
  provider: string | null;
  error: string | null;
  created_at: string;
  body: string;
};

type Props = {
  organizationId: string;
  initial: Settings | null;
  recent: MessageRow[];
};

export function NotifySettingsForm({ organizationId, initial, recent }: Props) {
  const [smsEnabled, setSmsEnabled] = useState(initial?.sms_enabled ?? false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    initial?.whatsapp_enabled ?? false,
  );
  const [emailEnabled, setEmailEnabled] = useState(initial?.email_enabled ?? false);
  const [dryRun, setDryRun] = useState(initial?.dry_run ?? true);
  const [opsMobile, setOpsMobile] = useState(initial?.ops_mobile ?? "");
  const [opsEmail, setOpsEmail] = useState(initial?.ops_email ?? "");
  const [compliance, setCompliance] = useState(
    initial?.compliance_alerts_enabled ?? true,
  );
  const [agreements, setAgreements] = useState(
    initial?.agreement_reminders_enabled ?? true,
  );
  const [clients, setClients] = useState(
    initial?.client_reminders_enabled ?? true,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSave() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await saveNotifySettings({
        organizationId,
        smsEnabled,
        whatsappEnabled,
        emailEnabled,
        dryRun,
        opsMobile,
        opsEmail,
        complianceAlertsEnabled: compliance,
        agreementRemindersEnabled: agreements,
        clientRemindersEnabled: clients,
      });
      if (!res.ok) setError(res.error);
      else setMessage("Saved.");
    });
  }

  function onDispatch() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await refreshAndDispatchOutbound();
      if (!res.ok) setError(res.error);
      else setMessage(`Dispatched: ${JSON.stringify(res.dispatch)}`);
    });
  }

  function onTest(channel: "sms" | "whatsapp") {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await enqueueTestOutbound(organizationId, channel, opsMobile);
      if (!res.ok) setError(res.error);
      else setMessage(`Test ${channel} queued/dispatched.`);
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div>
          <h2 className="font-medium">WhatsApp & SMS</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            M07 · V1.1 — Edge Function <code>send-outbound</code>. Keep dry-run on until Twilio /
            MSG91 secrets and DLT/WhatsApp templates are approved.
          </p>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Ops mobile (E.164 / 10-digit India)</span>
          <input
            value={opsMobile}
            onChange={(e) => setOpsMobile(e.target.value)}
            placeholder="+9198XXXXXXXX"
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Ops email (compliance alerts)</span>
          <input
            type="email"
            value={opsEmail}
            onChange={(e) => setOpsEmail(e.target.value)}
            placeholder="ops@yourcompany.in"
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2"
          />
        </label>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={smsEnabled}
              onChange={(e) => setSmsEnabled(e.target.checked)}
            />
            SMS enabled
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={whatsappEnabled}
              onChange={(e) => setWhatsappEnabled(e.target.checked)}
            />
            WhatsApp enabled
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
            />
            Email enabled
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry-run (no live send)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={compliance}
              onChange={(e) => setCompliance(e.target.checked)}
            />
            Permit expiry alerts
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={agreements}
              onChange={(e) => setAgreements(e.target.checked)}
            />
            Agreement ending → ops
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={clients}
              onChange={(e) => setClients(e.target.checked)}
            />
            Agreement ending → client SMS
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onSave}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onDispatch}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
          >
            Refresh alerts + dispatch queue
          </button>
          <button
            type="button"
            disabled={pending || !opsMobile}
            onClick={() => onTest("sms")}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
          >
            Test SMS
          </button>
          <button
            type="button"
            disabled={pending || !opsMobile}
            onClick={() => onTest("whatsapp")}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
          >
            Test WhatsApp
          </button>
        </div>

        {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <div className="rounded-md bg-[var(--wash)] p-3 text-xs text-[var(--muted)]">
          <p className="font-medium text-[var(--ink)]">Provider secrets (CLI)</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">
            {`supabase secrets set --project-ref bzgdutrmehuojindfyxi \\
  TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... \\
  TWILIO_FROM_NUMBER=+1... TWILIO_WHATSAPP_FROM=whatsapp:+1...
# or MSG91_AUTH_KEY=... MSG91_SENDER_ID=H360IN`}
          </pre>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Recent outbound</h2>
        {!recent.length ? (
          <p className="text-sm text-[var(--muted)]">No messages yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm">
            {recent.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <p className="font-medium">
                  {m.channel} · {m.status} · {m.template_key}
                </p>
                <p className="text-[var(--muted)]">
                  {m.to_e164}
                  {m.provider ? ` · ${m.provider}` : ""}
                  {" · "}
                  {new Date(m.created_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}
                </p>
                {m.error ? <p className="text-red-700">{m.error}</p> : null}
                <p className="mt-1 text-xs text-[var(--muted)]">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
