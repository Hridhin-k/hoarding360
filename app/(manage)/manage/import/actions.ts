"use server";

import { createClient } from "@/lib/supabase/server";
import {
  groupValidRows,
  type ValidatedImportRow,
} from "@/lib/domain/import-boards";
import { logActivity } from "@/lib/domain/activity";

export type ImportApplyResult =
  | {
      ok: true;
      boardsCreated: number;
      facesCreated: number;
      skippedExisting: number;
      jobId: string | null;
    }
  | { ok: false; error: string };

export async function applyBoardImport(
  organizationId: string,
  validRows: ValidatedImportRow[],
): Promise<ImportApplyResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, error: "Not signed in" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .is("deactivated_at", null)
    .maybeSingle();

  if (!membership) return { ok: false, error: "Not a member of this organization" };

  const groups = groupValidRows(validRows.filter((r) => r.ok));
  if (!groups.length) return { ok: false, error: "No valid rows to import" };

  const { data: job } = await supabase
    .from("import_jobs")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      entity_kind: "boards",
      status: "running",
      summary: { total_groups: groups.length },
    })
    .select("id")
    .single();

  let boardsCreated = 0;
  let facesCreated = 0;
  let skippedExisting = 0;
  const errors: string[] = [];

  for (const g of groups) {
    const { data: existing } = await supabase
      .from("boards")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("board_code", g.board_code)
      .is("deleted_at", null)
      .maybeSingle();

    let boardId = existing?.id as string | undefined;

    if (boardId) {
      skippedExisting += 1;
    } else {
      const { data: board, error: boardError } = await supabase
        .from("boards")
        .insert({
          organization_id: organizationId,
          board_code: g.board_code,
          name: g.name,
          structure_type: g.structure_type || "hoarding",
          city: g.city || null,
          district: g.district || null,
          state: g.state || null,
          pin_code: g.pin_code || null,
          address_line: g.address_line || null,
          landmark: g.landmark || null,
          road_name: g.road_name || null,
          lat: g.lat,
          lng: g.lng,
          lifecycle_status: "active",
        })
        .select("id")
        .single();

      if (boardError || !board) {
        errors.push(`${g.board_code}: ${boardError?.message ?? "board insert failed"}`);
        continue;
      }
      boardId = board.id;
      boardsCreated += 1;
      await logActivity(supabase, {
        organizationId,
        entityType: "board",
        entityId: board.id,
        eventType: "board.created",
        boardId: board.id,
        toValue: {
          board_code: g.board_code,
          name: g.name,
          via: "import",
        },
      });
    }

    for (const face of g.faces) {
      const { data: existingFace } = await supabase
        .from("board_faces")
        .select("id")
        .eq("board_id", boardId)
        .eq("face_label", face.face_label)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingFace) continue;

      const { error: faceError } = await supabase.from("board_faces").insert({
        organization_id: organizationId,
        board_id: boardId,
        face_label: face.face_label,
        width_ft: face.width_ft,
        height_ft: face.height_ft,
        illumination: face.illumination || "nonlit",
        facing_direction: face.facing_direction || null,
        card_rate_paise: face.card_rate_paise,
        is_publishable: true,
        published_at: new Date().toISOString(),
      });

      if (faceError) {
        errors.push(
          `${g.board_code}/${face.face_label}: ${faceError.message}`,
        );
      } else {
        facesCreated += 1;
      }
    }
  }

  if (job?.id) {
    await supabase
      .from("import_jobs")
      .update({
        status: errors.length ? "completed_with_errors" : "completed",
        finished_at: new Date().toISOString(),
        summary: {
          boardsCreated,
          facesCreated,
          skippedExisting,
          errors: errors.slice(0, 50),
        },
      })
      .eq("id", job.id);
  }

  if (!boardsCreated && !facesCreated && errors.length) {
    return { ok: false, error: errors[0] };
  }

  if (job?.id) {
    await logActivity(supabase, {
      organizationId,
      entityType: "import_job",
      entityId: job.id,
      eventType: "import.completed",
      toValue: {
        boards_created: boardsCreated,
        faces_created: facesCreated,
        skipped_existing: skippedExisting,
      },
    });
  }

  return {
    ok: true,
    boardsCreated,
    facesCreated,
    skippedExisting,
    jobId: job?.id ?? null,
  };
}

export async function applyClientImport(
  organizationId: string,
  rows: { raw: Record<string, string> }[],
): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in" };

  let created = 0;
  let skipped = 0;

  for (const { raw } of rows) {
    const name = raw.name?.trim();
    if (!name) continue;

    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", name)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      skipped += 1;
      continue;
    }

    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        organization_id: organizationId,
        name,
        gstin: raw.gstin?.trim() || null,
        industry: raw.industry?.trim() || null,
        billing_address: raw.billing_address?.trim() || null,
        payment_terms: raw.payment_terms?.trim() || null,
      })
      .select("id")
      .single();

    if (error || !client) return { ok: false, error: error?.message ?? "Client insert failed" };
    created += 1;

    if (raw.contact_name?.trim()) {
      await supabase.from("client_contacts").insert({
        organization_id: organizationId,
        client_id: client.id,
        name: raw.contact_name.trim(),
        email: raw.contact_email?.trim() || null,
        phone: raw.contact_phone?.trim() || null,
        is_primary: true,
      });
    }
  }

  await logActivity(supabase, {
    organizationId,
    entityType: "import",
    entityId: organizationId,
    eventType: "import.completed",
    toValue: { kind: "clients", created, skipped },
  });

  return { ok: true, created, skipped };
}

export async function applyAgreementImport(
  organizationId: string,
  rows: { raw: Record<string, string> }[],
): Promise<{ ok: true; created: number; failed: number; errors: string[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in" };

  const { rupeesToPaise } = await import("@/lib/domain/import-entities");

  let created = 0;
  let failed = 0;
  const errors: string[] = [];

  // Group by client+ref+dates so multi-face lines share one agreement
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = [
      row.raw.client_name?.trim().toLowerCase(),
      row.raw.ref_code?.trim() || "",
      row.raw.starts_on,
      row.raw.ends_on,
    ].join("|");
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  for (const [, faceRows] of groups) {
    const head = faceRows[0]?.raw;
    if (!head) continue;

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("name", head.client_name.trim())
      .is("deleted_at", null)
      .maybeSingle();

    if (!client) {
      failed += faceRows.length;
      errors.push(`Client not found: ${head.client_name}`);
      continue;
    }

    const valuePaise =
      rupeesToPaise(head.value_rupees) ??
      faceRows.reduce((s, r) => s + (rupeesToPaise(r.raw.rate_rupees) ?? 0), 0);

    const { data: agr, error: agrError } = await supabase
      .from("agreements")
      .insert({
        organization_id: organizationId,
        client_id: client.id,
        ref_code: head.ref_code?.trim() || null,
        starts_on: head.starts_on,
        ends_on: head.ends_on,
        value_paise: valuePaise,
        status: head.status?.trim() || "active",
      })
      .select("id")
      .single();

    if (agrError || !agr) {
      failed += faceRows.length;
      errors.push(agrError?.message ?? "Agreement create failed");
      continue;
    }

    for (const fr of faceRows) {
      const code = fr.raw.board_code.trim().toUpperCase();
      const { data: board } = await supabase
        .from("boards")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("board_code", code)
        .is("deleted_at", null)
        .maybeSingle();

      if (!board) {
        failed += 1;
        errors.push(`Board ${code} not found`);
        continue;
      }

      const { data: face } = await supabase
        .from("board_faces")
        .select("id")
        .eq("board_id", board.id)
        .eq("face_label", fr.raw.face_label.trim())
        .is("deleted_at", null)
        .maybeSingle();

      if (!face) {
        failed += 1;
        errors.push(`Face ${fr.raw.face_label} on ${code} not found`);
        continue;
      }

      const { error: faceError } = await supabase.from("agreement_faces").insert({
        organization_id: organizationId,
        agreement_id: agr.id,
        face_id: face.id,
        starts_on: fr.raw.starts_on,
        ends_on: fr.raw.ends_on,
        rate_paise: rupeesToPaise(fr.raw.rate_rupees) ?? 0,
      });

      if (faceError) {
        failed += 1;
        errors.push(`${code}/${fr.raw.face_label}: ${faceError.message}`);
      } else {
        created += 1;
      }
    }

    await supabase.rpc("sync_agreement_occupancy", { p_agreement_id: agr.id });
  }

  await logActivity(supabase, {
    organizationId,
    entityType: "import",
    entityId: organizationId,
    eventType: "import.completed",
    toValue: { kind: "agreements", faces: created, failed },
  });

  return { ok: true, created, failed, errors: errors.slice(0, 20) };
}

export async function applyPermitImport(
  organizationId: string,
  rows: { raw: Record<string, string> }[],
): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in" };

  const { truthyFlag } = await import("@/lib/domain/import-entities");

  let created = 0;
  let skipped = 0;

  for (const { raw } of rows) {
    const code = raw.board_code?.trim().toUpperCase();
    if (!code) continue;

    const { data: board } = await supabase
      .from("boards")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("board_code", code)
      .is("deleted_at", null)
      .maybeSingle();

    if (!board) {
      skipped += 1;
      continue;
    }

    const { error } = await supabase.from("compliance_records").insert({
      organization_id: organizationId,
      board_id: board.id,
      clearance_type: raw.clearance_type.trim(),
      governing_body: raw.governing_body.trim(),
      reference_no: raw.reference_no?.trim() || null,
      issue_date: raw.issue_date?.trim() || null,
      expiry_date: raw.expiry_date?.trim() || null,
      is_mandatory: truthyFlag(raw.is_mandatory),
    });

    if (error) return { ok: false, error: `${code}: ${error.message}` };
    created += 1;
  }

  await supabase.rpc("recompute_all_compliance_statuses");
  await logActivity(supabase, {
    organizationId,
    entityType: "import",
    entityId: organizationId,
    eventType: "import.completed",
    toValue: { kind: "permits", created, skipped },
  });

  return { ok: true, created, skipped };
}
