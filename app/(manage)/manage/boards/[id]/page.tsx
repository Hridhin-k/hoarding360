import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/manage/activity-timeline";
import { BoardDocumentsVault } from "@/components/manage/board-documents-vault";
import { BoardLocationMap } from "@/components/manage/board-location-map";
import { BoardPhotoGallery } from "@/components/manage/board-photo-gallery";
import { BoardMarketplacePanel } from "@/components/manage/board-marketplace-panel";
import { PublishOverrideForm } from "@/components/manage/publish-override-form";
import { BoardQrCard } from "@/components/manage/board-qr-card";
import { FaceRateHistory } from "@/components/manage/face-rate-history";
import { ProofShareButton } from "@/components/manage/proof-share-button";
import { ComplianceRecordForm } from "@/components/manage/compliance-record-form";
import { ComplianceRecordsList } from "@/components/manage/compliance-records-list";
import { createClient } from "@/lib/supabase/server";
import type { ActivityEvent } from "@/lib/domain/activity";
import { ThreeStatusBadges, worstOccupancy } from "@/components/manage/status-badges";
import { canSeeCosts, canSeeFloorRates } from "@/lib/domain/roles";
import type { VaultDocument } from "@/lib/domain/documents";
import type { ComplianceStatus, OccupancyStatus, OrgRole } from "@/lib/domain/status";
import { formatInrFromPaise, formatIstDate } from "@/lib/format";
import { PROOF_GEO_RADIUS_M } from "@/lib/domain/field";

const ALL_TABS = [
  { key: "overview", label: "Overview", ready: true, financeOnly: false },
  { key: "gallery", label: "Gallery", ready: true, financeOnly: false },
  { key: "occupancy", label: "Occupancy", ready: true, financeOnly: false },
  { key: "rates", label: "Rate history", ready: true, financeOnly: false },
  { key: "compliance", label: "Compliance", ready: true, financeOnly: false },
  { key: "agreements", label: "Agreements", ready: true, financeOnly: false },
  { key: "activity", label: "Activity", ready: true, financeOnly: false },
  { key: "documents", label: "Documents", ready: true, financeOnly: false },
  { key: "proof", label: "Proof", ready: true, financeOnly: false },
  { key: "incidents", label: "Incidents", ready: true, financeOnly: false },
  { key: "marketplace", label: "Marketplace", ready: true, financeOnly: false },
  { key: "history", label: "History", ready: false, financeOnly: false },
  { key: "costs", label: "Costs", ready: false, financeOnly: true },
  { key: "profitability", label: "Profitability", ready: false, financeOnly: true },
] as const;

export default async function Board360Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  const { data: membership } = userId
    ? await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", userId)
        .is("deactivated_at", null)
        .limit(1)
        .maybeSingle()
    : { data: null };
  const role = (membership?.role as OrgRole | undefined) ?? null;
  const showFinanceTabs = canSeeCosts(role);
  const showFloor = canSeeFloorRates(role);
  const TABS = ALL_TABS.filter((t) => !t.financeOnly || showFinanceTabs);
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : "overview";

  const { data: board } = await supabase
    .from("boards")
    .select(
      "id, organization_id, board_code, name, city, district, state, structure_type, ownership_type, installed_on, lifecycle_status, road_name, address_line, landmark, lat, lng, how_to_reach, pin_code, ward_zone, street_view_url, meter_no, qr_token, compliance_publish_override_until, compliance_publish_override_reason",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!board) notFound();

  const { data: orgClearanceTypes } = await supabase
    .from("organization_clearance_types")
    .select("code, label, is_mandatory_default")
    .eq("organization_id", board.organization_id)
    .eq("active", true)
    .order("sort_order");

  const { data: faces } = await supabase
    .from("board_faces")
    .select(
      "id, face_label, width_ft, height_ft, area_sqft, illumination, card_rate_paise, occupancy_status, facing_direction, available_from, is_publishable, price_on_request, market_title, market_blurb",
    )
    .eq("board_id", id)
    .is("deleted_at", null)
    .order("face_label");

  const { data: photoRows } = await supabase
    .from("board_photos")
    .select("id, kind, storage_path, captured_at, is_cover")
    .eq("board_id", id)
    .is("deleted_at", null)
    .order("captured_at", { ascending: false });

  const photos = await Promise.all(
    (photoRows ?? []).map(async (p) => {
      const { data: signed } = await supabase.storage
        .from("board-images")
        .createSignedUrl(p.storage_path, 60 * 60);
      return { ...p, signedUrl: signed?.signedUrl ?? null };
    }),
  );

  const { data: complianceRows } = await supabase
    .from("compliance_records")
    .select(
      "id, clearance_type, governing_body, reference_no, issue_date, expiry_date, status, is_mandatory, under_renewal, fee_paid_paise, renewal_cycle_months",
    )
    .eq("board_id", id)
    .is("deleted_at", null)
    .order("expiry_date", { ascending: true, nullsFirst: true });

  const { data: rollup } = await supabase.rpc("board_compliance_rollup", {
    p_board_id: id,
  });

  const faceIds = (faces ?? []).map((f) => f.id);

  const { data: occupancyRows } = faceIds.length
    ? await supabase
        .from("occupancy_periods")
        .select(
          "id, face_id, status, starts_on, ends_on, agreement_id, block_reason, agreements(ref_code, clients(name))",
        )
        .in("face_id", faceIds)
        .order("starts_on", { ascending: false })
    : { data: [] as never[] };

  const { data: boardAgreements } = faceIds.length
    ? await supabase
        .from("agreement_faces")
        .select(
          "id, face_id, starts_on, ends_on, rate_paise, board_faces(face_label), agreements(id, ref_code, status, clients(name))",
        )
        .in("face_id", faceIds)
        .is("deleted_at", null)
        .order("starts_on", { ascending: false })
    : { data: [] as never[] };

  const { data: activityRows } = await supabase
    .from("activity_events")
    .select(
      "id, organization_id, actor_id, entity_type, entity_id, event_type, board_id, from_value, to_value, reason, occurred_at",
    )
    .eq("board_id", id)
    .order("occurred_at", { ascending: false })
    .limit(50);

  const activityEvents = (activityRows ?? []) as ActivityEvent[];

  const { data: docRows } = await supabase
    .from("documents")
    .select(
      "id, doc_type, file_name, storage_path, mime_type, byte_size, reference_no, issue_date, expiry_date, created_at",
    )
    .eq("entity_type", "board")
    .eq("entity_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const documents: VaultDocument[] = await Promise.all(
    (docRows ?? []).map(async (d) => {
      const { data: signed } = await supabase.storage
        .from("org-documents")
        .createSignedUrl(d.storage_path, 60 * 60);
      return { ...d, signedUrl: signed?.signedUrl ?? null };
    }),
  );

  const { data: proofRows } = await supabase
    .from("proof_of_display")
    .select("id, captured_at, geo_ok, distance_m, notes, lat, lng")
    .eq("board_id", id)
    .is("deleted_at", null)
    .order("captured_at", { ascending: false })
    .limit(30);

  const { data: incidentRows } = await supabase
    .from("incidents")
    .select("id, title, status, severity, category, created_at, description")
    .eq("board_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  const faceIdsForRates = (faces ?? []).map((f) => f.id);
  const { data: rateHistoryRows } = faceIdsForRates.length
    ? await supabase
        .from("face_rate_history")
        .select(
          "id, face_id, card_rate_paise, floor_rate_paise, printing_charge_paise, mounting_charge_paise, reason, occurred_at",
        )
        .in("face_id", faceIdsForRates)
        .order("occurred_at", { ascending: false })
        .limit(100)
    : { data: [] as never[] };

  const faceLabelById = new Map((faces ?? []).map((f) => [f.id, f.face_label]));

  const { data: marketSettings } = await supabase
    .from("organization_marketplace_settings")
    .select(
      "marketplace_enabled, public_display_name, default_price_on_request, accept_enquiries",
    )
    .eq("organization_id", board.organization_id)
    .maybeSingle();

  const { data: listingRows } = faceIds.length
    ? await supabase
        .from("marketplace_listings")
        .select("face_id, is_listed")
        .in("face_id", faceIds)
    : { data: [] as { face_id: string; is_listed: boolean }[] };

  const listedMap = new Map(
    (listingRows ?? []).map((r) => [r.face_id, r.is_listed]),
  );

  const complianceStatus = (rollup as ComplianceStatus | null) ?? "missing";
  const boardOccupancy = worstOccupancy(
    (faces ?? []).map((f) => f.occupancy_status as OccupancyStatus),
  );

  const marketBlockers: string[] = [];
  if (board.lifecycle_status !== "active") {
    marketBlockers.push("Set lifecycle to active (edit board).");
  }
  if (board.lat == null || board.lng == null) {
    marketBlockers.push("Add GPS coordinates.");
  }
  if (!photos.length) {
    marketBlockers.push("Optional: upload a photo (listings work without it in preview).");
  }
  if (complianceStatus === "expired") {
    marketBlockers.push(
      board.compliance_publish_override_until &&
        board.compliance_publish_override_until >=
          new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
        ? `Expired clearance — publish override active until ${board.compliance_publish_override_until}.`
        : "Expired mandatory clearance blocks publish — renew or grant audited override.",
    );
  }

  const canOverride =
    role === "company_admin" || role === "operations_manager";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/manage/boards" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          ← Boards
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--muted)]">{board.board_code}</p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl">{board.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {[board.city, board.district, board.state].filter(Boolean).join(" · ") ||
                "Location TBD"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ThreeStatusBadges
              lifecycle={board.lifecycle_status}
              compliance={complianceStatus}
              occupancy={boardOccupancy}
            />
            <Link
              href={`/manage/boards/${id}/edit`}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-[var(--wash)]"
            >
              Edit board
            </Link>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-px text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/manage/boards/${id}?tab=${t.key}`}
            className={
              tab === t.key
                ? "border-b-2 border-[var(--accent)] px-3 py-2 font-medium text-[var(--ink)]"
                : "px-3 py-2 text-[var(--muted)] hover:text-[var(--ink)]"
            }
            title={t.ready ? undefined : "Coming in a later version"}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <BoardLocationMap lat={board.lat} lng={board.lng} name={board.name} />
            <BoardQrCard qrToken={board.qr_token} boardCode={board.board_code} />
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-medium">Structure</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Type" value={board.structure_type} />
                <Row
                  label="Ownership"
                  value={String(board.ownership_type ?? "owned").replaceAll("_", " ")}
                />
                <Row
                  label="Installed"
                  value={board.installed_on ? formatIstDate(board.installed_on) : null}
                />
                <Row label="Address" value={board.address_line} />
                <Row label="Landmark" value={board.landmark} />
                <Row label="Road" value={board.road_name} />
                <Row label="Ward / zone" value={board.ward_zone} />
                <Row label="Meter no." value={board.meter_no} />
                <Row label="PIN" value={board.pin_code} />
                <Row label="How to reach" value={board.how_to_reach} />
                {board.street_view_url ? (
                  <div className="sm:col-span-2">
                    <dt className="text-[var(--muted)]">Street view</dt>
                    <dd>
                      <a
                        href={board.street_view_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--primary)] underline"
                      >
                        Open street view
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-medium">Faces</h2>
            <ul className="mt-3 space-y-3">
              {(faces ?? []).map((f) => (
                <li
                  key={f.id}
                  className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3 text-sm last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">Face {f.face_label}</p>
                    <p className="text-[var(--muted)]">
                      {f.width_ft && f.height_ft
                        ? `${f.width_ft}×${f.height_ft} ft`
                        : "size TBD"}
                      {f.area_sqft ? ` · ${f.area_sqft} sq ft` : ""}
                      {f.illumination ? ` · ${f.illumination}` : ""}
                      {f.facing_direction ? ` · ${f.facing_direction}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Occupancy: {f.occupancy_status}
                      {f.available_from
                        ? ` · Available from ${formatIstDate(String(f.available_from))}`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0">{formatInrFromPaise(f.card_rate_paise)}</span>
                </li>
              ))}
              {!faces?.length ? (
                <li className="text-sm text-[var(--muted)]">No faces — edit board to add</li>
              ) : null}
            </ul>
          </div>
        </section>
      ) : null}

      {tab === "gallery" ? (
        <BoardPhotoGallery
          organizationId={board.organization_id}
          boardId={board.id}
          photos={photos}
        />
      ) : null}

      {tab === "compliance" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              Many clearances per board. Status is computed from expiry (never set by hand).
            </p>
            <ComplianceRecordForm
              organizationId={board.organization_id}
              boardId={board.id}
              clearanceTypes={orgClearanceTypes ?? []}
            />
          </div>
          <PublishOverrideForm
            boardId={board.id}
            canOverride={canOverride}
            overrideUntil={board.compliance_publish_override_until}
            overrideReason={board.compliance_publish_override_reason}
            hasExpiredMandatory={complianceStatus === "expired"}
          />
          <ComplianceRecordsList
            organizationId={board.organization_id}
            boardId={board.id}
            records={(complianceRows ?? []).map((r) => ({
              ...r,
              status: r.status as ComplianceStatus,
            }))}
          />
        </div>
      ) : null}

      {tab === "agreements" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              href={`/manage/agreements/new`}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              New agreement
            </Link>
          </div>
          {!boardAgreements?.length ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
              No agreements on this board&apos;s faces yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {boardAgreements.map((row) => {
                const agr = Array.isArray(row.agreements)
                  ? row.agreements[0]
                  : row.agreements;
                const face = Array.isArray(row.board_faces)
                  ? row.board_faces[0]
                  : row.board_faces;
                const client = agr?.clients
                  ? Array.isArray(agr.clients)
                    ? agr.clients[0]
                    : agr.clients
                  : null;
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {client?.name ?? "Client"} · Face {face?.face_label ?? "—"}
                      </p>
                      <p className="text-[var(--muted)]">
                        {agr?.ref_code || agr?.id?.slice(0, 8)} ·{" "}
                        {formatIstDate(row.starts_on)} → {formatIstDate(row.ends_on)} ·{" "}
                        {agr?.status}
                      </p>
                    </div>
                    <p>{formatInrFromPaise(row.rate_paise)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            M08 · Append-only audit trail for this structure
          </p>
          <ActivityTimeline
            events={activityEvents}
            emptyMessage="No activity yet. Create or edit this board, add a clearance, photo, or agreement."
          />
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            M03 · Board document vault (permits, deeds, contracts)
          </p>
          <BoardDocumentsVault
            organizationId={board.organization_id}
            boardId={board.id}
            documents={documents}
          />
        </div>
      ) : null}

      {tab === "proof" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              M12 · Proof of display · geo-check ≤{PROOF_GEO_RADIUS_M} m
            </p>
            <div className="flex flex-wrap gap-2">
              <ProofShareButton boardId={id} />
              {proofRows?.length ? (
                <a
                  href={`/api/proof-pack?boardId=${id}`}
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  Download proof pack PDF
                </a>
              ) : null}
            </div>
          </div>
          {!proofRows?.length ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
              No proofs yet. Field technicians submit via QR scan.
            </p>
          ) : (
            <>
              <p className="text-xs text-[var(--muted)]">
                Pack includes up to 12 latest captures with photos and geo status — branded for
                client verification.
              </p>
              <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                {proofRows.map((p) => (
                  <li key={p.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">
                      {p.geo_ok ? "Geo OK" : "Outside radius"} ·{" "}
                      {p.distance_m != null ? `${Math.round(p.distance_m)} m` : "—"}
                    </p>
                    <p className="text-[var(--muted)]">
                      {new Date(p.captured_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                      {p.notes ? ` · ${p.notes}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      {tab === "incidents" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">M12 · Field incidents</p>
          {!incidentRows?.length ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
              No incidents reported.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {incidentRows.map((inc) => (
                <li key={inc.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">
                    {inc.title} · {inc.status} · {inc.severity}
                  </p>
                  <p className="text-[var(--muted)]">
                    {inc.category} ·{" "}
                    {new Date(inc.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </p>
                  {inc.description ? (
                    <p className="mt-1 text-[var(--muted)]">{inc.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "marketplace" ? (
        <div className="space-y-4">
          <PublishOverrideForm
            boardId={board.id}
            canOverride={canOverride}
            overrideUntil={board.compliance_publish_override_until}
            overrideReason={board.compliance_publish_override_reason}
            hasExpiredMandatory={complianceStatus === "expired"}
          />
          <BoardMarketplacePanel
            organizationId={board.organization_id}
            boardId={board.id}
            orgSettings={marketSettings}
            blockers={marketBlockers}
            faces={(faces ?? []).map((f) => ({
              id: f.id,
              face_label: f.face_label,
              is_publishable: Boolean(f.is_publishable),
              price_on_request: Boolean(f.price_on_request),
              card_rate_paise: f.card_rate_paise,
              market_title: f.market_title,
              market_blurb: f.market_blurb,
              listed: listedMap.get(f.id) ?? false,
            }))}
          />
        </div>
      ) : null}

      {tab === "occupancy" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(faces ?? []).map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
              >
                <p className="font-medium">Face {f.face_label}</p>
                <p className="mt-1 text-[var(--muted)]">
                  Status: {f.occupancy_status}
                  {f.available_from
                    ? ` · Available from ${formatIstDate(String(f.available_from))}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
          <h3 className="text-sm font-medium">Timeline</h3>
          {!occupancyRows?.length ? (
            <p className="text-sm text-[var(--muted)]">No occupancy periods yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {occupancyRows.map((p) => {
                const agr = Array.isArray(p.agreements) ? p.agreements[0] : p.agreements;
                const client = agr?.clients
                  ? Array.isArray(agr.clients)
                    ? agr.clients[0]
                    : agr.clients
                  : null;
                const face = faces?.find((f) => f.id === p.face_id);
                return (
                  <li key={p.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">
                      Face {face?.face_label ?? "—"} · {p.status}
                    </p>
                    <p className="text-[var(--muted)]">
                      {formatIstDate(p.starts_on)} → {formatIstDate(p.ends_on)}
                      {client?.name ? ` · ${client.name}` : ""}
                      {agr?.ref_code ? ` · ${agr.ref_code}` : ""}
                      {p.block_reason ? ` · ${p.block_reason}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "rates" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            M02 · Append-only rate changes ·{" "}
            {showFloor ? "includes floor / charges" : "card rates only (sales)"}
          </p>
          <FaceRateHistory
            showFloor={showFloor}
            rows={(rateHistoryRows ?? []).map((r) => ({
              ...r,
              face_label: faceLabelById.get(r.face_id),
            }))}
          />
        </div>
      ) : null}

      {tab !== "overview" &&
      tab !== "gallery" &&
      tab !== "compliance" &&
      tab !== "agreements" &&
      tab !== "occupancy" &&
      tab !== "rates" &&
      tab !== "activity" &&
      tab !== "documents" &&
      tab !== "proof" &&
      tab !== "incidents" &&
      tab !== "marketplace" ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="font-medium text-[var(--ink)]">
            {TABS.find((t) => t.key === tab)?.label} — coming soon
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Tab stays visible empty (product rule). Ships in a later module.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right">{value || "—"}</dd>
    </div>
  );
}
