"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/pending-button";
import { saveCompanyProfile } from "@/app/(manage)/manage/settings/team-actions";

const inputClass =
  "rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]";

type Props = {
  organizationId: string;
  initial: {
    name: string;
    legal_name: string | null;
    gstin: string | null;
    address_line: string | null;
    city: string | null;
    state: string | null;
    pin_code: string | null;
    brand_primary: string | null;
  };
};

export function CompanyProfileForm({ organizationId, initial }: Props) {
  const [name, setName] = useState(initial.name);
  const [legalName, setLegalName] = useState(initial.legal_name ?? "");
  const [gstin, setGstin] = useState(initial.gstin ?? "");
  const [addressLine, setAddressLine] = useState(initial.address_line ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [state, setState] = useState(initial.state ?? "");
  const [pinCode, setPinCode] = useState(initial.pin_code ?? "");
  const [brandPrimary, setBrandPrimary] = useState(initial.brand_primary ?? "#1A73E8");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSave() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await saveCompanyProfile({
        organizationId,
        name,
        legalName,
        gstin,
        addressLine,
        city,
        state,
        pinCode,
        brandPrimary,
      });
      if (!res.ok) setError(res.error);
      else setMessage("Company profile saved.");
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-[var(--border)] bg-white p-4">
      <div>
        <h2 className="text-sm font-medium text-[var(--ink)]">Company profile</h2>
        <p className="text-xs text-[var(--muted)]">M01 · GSTIN, address, brand — used on proof packs</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">Trading name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">Legal name</span>
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">GSTIN</span>
          <input value={gstin} onChange={(e) => setGstin(e.target.value)} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Brand colour</span>
          <input
            type="color"
            value={brandPrimary || "#1A73E8"}
            onChange={(e) => setBrandPrimary(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-md border border-[var(--border)] bg-white"
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">Address</span>
          <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">City</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">State</span>
          <input value={state} onChange={(e) => setState(e.target.value)} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">PIN</span>
          <input value={pinCode} onChange={(e) => setPinCode(e.target.value)} className={inputClass} />
        </label>
      </div>
      {error ? <p className="text-sm text-[var(--google-red)]">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--google-green)]">{message}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={onSave}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <Spinner /> : null}{pending ? "Saving…" : "Save company"}
      </button>
    </section>
  );
}
