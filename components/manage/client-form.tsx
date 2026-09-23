"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { logActivity } from "@/lib/domain/activity";
import { normalizeIndianMobile } from "@/lib/format";

const inputClass =
  "rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

type Props = {
  organizationId: string;
  initial?: {
    id: string;
    name: string;
    gstin: string;
    billing_address: string;
    industry: string;
    payment_terms: string;
    reminder_email?: string;
    reminder_mobile?: string;
    contract_reminders_enabled?: boolean;
  };
};

export function ClientForm({ organizationId, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [gstin, setGstin] = useState(initial?.gstin ?? "");
  const [billingAddress, setBillingAddress] = useState(initial?.billing_address ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [paymentTerms, setPaymentTerms] = useState(initial?.payment_terms ?? "");
  const [reminderEmail, setReminderEmail] = useState(initial?.reminder_email ?? "");
  const [reminderMobile, setReminderMobile] = useState(initial?.reminder_mobile ?? "");
  const [remindersOn, setRemindersOn] = useState(
    initial?.contract_reminders_enabled ?? true,
  );
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const mobile = reminderMobile.trim()
      ? normalizeIndianMobile(reminderMobile)
      : null;
    if (reminderMobile.trim() && !mobile) {
      setLoading(false);
      setError("Reminder mobile must be a valid +91 number");
      return;
    }

    const payload = {
      organization_id: organizationId,
      name: name.trim(),
      gstin: gstin.trim() || null,
      billing_address: billingAddress.trim() || null,
      industry: industry.trim() || null,
      payment_terms: paymentTerms.trim() || null,
      reminder_email: reminderEmail.trim() || null,
      reminder_mobile: mobile,
      contract_reminders_enabled: remindersOn,
    };

    if (initial?.id) {
      const { organization_id: _o, ...upd } = payload;
      const { error: updError } = await supabase
        .from("clients")
        .update(upd)
        .eq("id", initial.id);
      setLoading(false);
      if (updError) {
        setError(updError.message);
        return;
      }
      await logActivity(supabase, {
        organizationId,
        entityType: "client",
        entityId: initial.id,
        eventType: "client.updated",
        toValue: { name: payload.name },
      });
      router.push(`/manage/clients/${initial.id}`);
      router.refresh();
      return;
    }

    const { data: client, error: insertError } = await supabase
      .from("clients")
      .insert(payload)
      .select("id")
      .single();

    if (insertError || !client) {
      setLoading(false);
      setError(insertError?.message ?? "Could not create client");
      return;
    }

    if (contactName.trim()) {
      let phone: string | null = null;
      if (contactPhone.trim()) {
        phone = normalizeIndianMobile(contactPhone);
        if (!phone) {
          setLoading(false);
          setError("Phone must be a valid Indian mobile (+91 / 10 digits starting 6–9).");
          return;
        }
      }
      await supabase.from("client_contacts").insert({
        organization_id: organizationId,
        client_id: client.id,
        name: contactName.trim(),
        email: contactEmail.trim() || null,
        phone,
        is_primary: true,
      });
    }

    await logActivity(supabase, {
      organizationId,
      entityType: "client",
      entityId: client.id,
      eventType: "client.created",
      toValue: { name: payload.name },
    });

    setLoading(false);
    router.push(`/manage/clients/${client.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-lg gap-4">
      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Client name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">GSTIN</span>
        <input value={gstin} onChange={(e) => setGstin(e.target.value)} className={inputClass} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Billing address</span>
        <textarea
          rows={2}
          value={billingAddress}
          onChange={(e) => setBillingAddress(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Industry</span>
          <input value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Payment terms</span>
          <input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="Net 30"
            className={inputClass}
          />
        </label>
      </div>

      <fieldset className="grid gap-3 rounded-lg border border-[var(--border)] p-3">
        <legend className="px-1 text-sm text-[var(--muted)]">
          Contract reminders (M05)
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remindersOn}
            onChange={(e) => setRemindersOn(e.target.checked)}
          />
          Enable ending reminders for this client
        </label>
        <input
          placeholder="Reminder email"
          type="email"
          value={reminderEmail}
          onChange={(e) => setReminderEmail(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Reminder mobile (+91…)"
          value={reminderMobile}
          onChange={(e) => setReminderMobile(e.target.value)}
          className={inputClass}
        />
        <p className="text-xs text-[var(--muted)]">
          Destinations stored now · delivery when email/SMS provider is configured
        </p>
      </fieldset>

      {!initial ? (
        <fieldset className="grid gap-3 rounded-lg border border-[var(--border)] p-3">
          <legend className="px-1 text-sm text-[var(--muted)]">Primary contact (optional)</legend>
          <input
            placeholder="Name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className={inputClass}
          />
          <input
            placeholder="Email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className={inputClass}
          />
          <input
            placeholder="Mobile (+91…)"
            inputMode="tel"
            autoComplete="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className={inputClass}
          />
          <p className="text-xs text-[var(--muted)]">Stored as +91XXXXXXXXXX</p>
        </fieldset>
      ) : null}

      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Saving…" : initial ? "Save client" : "Create client"}
      </button>
    </form>
  );
}
