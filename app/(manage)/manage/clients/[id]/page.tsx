import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EntityDocumentsVault } from "@/components/manage/entity-documents-vault";
import { ClientForm } from "@/components/manage/client-form";
import type { VaultDocument } from "@/lib/domain/documents";
import { formatInrFromPaise, formatIstDate } from "@/lib/format";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, organization_id, name, gstin, billing_address, industry, payment_terms, reminder_email, reminder_mobile, contract_reminders_enabled",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!client) notFound();

  const [{ data: contacts }, { data: agreements }, { data: docRows }] =
    await Promise.all([
      supabase
        .from("client_contacts")
        .select("id, name, email, phone, is_primary")
        .eq("client_id", id)
        .is("deleted_at", null),
      supabase
        .from("agreements")
        .select("id, ref_code, starts_on, ends_on, value_paise, status")
        .eq("client_id", id)
        .is("deleted_at", null)
        .order("starts_on", { ascending: false }),
      supabase
        .from("documents")
        .select(
          "id, doc_type, file_name, storage_path, mime_type, byte_size, reference_no, issue_date, expiry_date, created_at, version_no, is_current",
        )
        .eq("entity_type", "client")
        .eq("entity_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]);

  const documents: VaultDocument[] = await Promise.all(
    (docRows ?? []).map(async (d) => {
      const { data: signed } = await supabase.storage
        .from("org-documents")
        .createSignedUrl(d.storage_path, 60 * 60);
      return { ...d, signedUrl: signed?.signedUrl ?? null };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/manage/clients" className="text-sm text-[var(--muted)]">
            ← Clients
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
            {client.name}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {[client.industry, client.gstin].filter(Boolean).join(" · ") || "No GST / industry"}
          </p>
        </div>
        <Link
          href={`/manage/agreements/new?client=${client.id}`}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          New agreement
        </Link>
      </div>

      <ClientForm
        organizationId={client.organization_id}
        initial={{
          id: client.id,
          name: client.name,
          gstin: client.gstin ?? "",
          billing_address: client.billing_address ?? "",
          industry: client.industry ?? "",
          payment_terms: client.payment_terms ?? "",
          reminder_email: client.reminder_email ?? "",
          reminder_mobile: client.reminder_mobile ?? "",
          contract_reminders_enabled: client.contract_reminders_enabled ?? true,
        }}
      />

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
        <h2 className="font-medium">Contacts</h2>
        {contacts?.length ? (
          <ul className="mt-3 space-y-1">
            {contacts.map((c) => (
              <li key={c.id} className="text-[var(--muted)]">
                {c.name}
                {c.is_primary ? " (primary)" : ""}
                {c.email ? ` · ${c.email}` : ""}
                {c.phone ? ` · ${c.phone}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[var(--muted)]">No contacts</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Agreements</h2>
        {!agreements?.length ? (
          <p className="text-sm text-[var(--muted)]">No agreements yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            {agreements.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <Link
                    href={`/manage/agreements/${a.id}`}
                    className="font-medium text-[var(--primary)] underline"
                  >
                    {a.ref_code || a.id.slice(0, 8)}
                  </Link>
                  <p className="text-[var(--muted)]">
                    {formatIstDate(a.starts_on)} → {formatIstDate(a.ends_on)} · {a.status}
                  </p>
                </div>
                <p>{formatInrFromPaise(a.value_paise)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Documents</h2>
        <EntityDocumentsVault
          organizationId={client.organization_id}
          entityType="client"
          entityId={client.id}
          documents={documents}
          title="Client documents"
        />
      </section>
    </div>
  );
}
