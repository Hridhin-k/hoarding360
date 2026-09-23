import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TerminateAgreementForm } from "@/components/manage/terminate-agreement-form";
import { ExtendAgreementForm } from "@/components/manage/extend-agreement-form";
import { ReviseAgreementForm } from "@/components/manage/revise-agreement-form";
import { ActivateAgreementForm } from "@/components/manage/activate-agreement-form";
import { EntityDocumentsVault } from "@/components/manage/entity-documents-vault";
import type { VaultDocument } from "@/lib/domain/documents";
import { formatInrFromPaise, formatIstDate } from "@/lib/format";

export default async function AgreementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: agreement } = await supabase
    .from("agreements")
    .select(
      "id, organization_id, ref_code, status, starts_on, ends_on, value_paise, client_id, clients(id, name), created_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!agreement) notFound();

  const client = Array.isArray(agreement.clients)
    ? agreement.clients[0]
    : agreement.clients;

  const [{ data: faces }, { data: docRows }] = await Promise.all([
    supabase
      .from("agreement_faces")
      .select(
        "id, face_id, starts_on, ends_on, rate_paise, deleted_at, board_faces(face_label, board_id, boards(board_code, name))",
      )
      .eq("agreement_id", id)
      .order("starts_on"),
    supabase
      .from("documents")
      .select(
        "id, doc_type, file_name, storage_path, mime_type, byte_size, reference_no, issue_date, expiry_date, created_at",
      )
      .eq("entity_type", "agreement")
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

  const open = agreement.status !== "terminated" && agreement.status !== "cancelled";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/manage/agreements" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          ← Agreements
        </Link>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-[var(--ink)]">
          {(client as { name?: string } | null)?.name ?? "Agreement"}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {agreement.ref_code || agreement.id.slice(0, 8)} · {agreement.status} ·{" "}
          {formatIstDate(agreement.starts_on)} → {formatIstDate(agreement.ends_on)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Contract value</p>
          <p className="mt-2 text-2xl font-medium">{formatInrFromPaise(agreement.value_paise)}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Client</p>
          <Link
            href={`/manage/clients/${agreement.client_id}`}
            className="mt-2 inline-block text-lg font-medium text-[var(--primary)] underline"
          >
            {(client as { name?: string } | null)?.name ?? "Open client"}
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Faces</h2>
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          {(faces ?? []).map((row) => {
            const face = Array.isArray(row.board_faces) ? row.board_faces[0] : row.board_faces;
            const board = face && "boards" in face
              ? Array.isArray(face.boards)
                ? face.boards[0]
                : face.boards
              : null;
            return (
              <li key={row.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {(board as { board_code?: string } | null)?.board_code ?? "Board"} · Face{" "}
                    {(face as { face_label?: string } | null)?.face_label ?? "—"}
                    {row.deleted_at ? " · released" : ""}
                  </p>
                  <p className="text-[var(--muted)]">
                    {formatIstDate(row.starts_on)} → {formatIstDate(row.ends_on)}
                  </p>
                </div>
                <p>{formatInrFromPaise(row.rate_paise)}</p>
              </li>
            );
          })}
          {!faces?.length ? (
            <li className="px-4 py-6 text-center text-sm text-[var(--muted)]">No faces attached</li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Documents</h2>
        <EntityDocumentsVault
          organizationId={agreement.organization_id}
          entityType="agreement"
          entityId={agreement.id}
          documents={documents}
          title="Agreement documents"
        />
      </section>

      {agreement.status === "draft" ? (
        <ActivateAgreementForm agreementId={agreement.id} />
      ) : null}

      {open && agreement.status !== "draft" ? (
        <>
          <ExtendAgreementForm
            agreementId={agreement.id}
            currentEndsOn={agreement.ends_on}
          />
          <ReviseAgreementForm agreementId={agreement.id} />
          <TerminateAgreementForm agreementId={agreement.id} />
        </>
      ) : null}

      {open && agreement.status === "draft" ? (
        <TerminateAgreementForm agreementId={agreement.id} />
      ) : null}
    </div>
  );
}
