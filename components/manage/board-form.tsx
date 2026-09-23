"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { logActivity } from "@/lib/domain/activity";
import {
  STRUCTURE_TYPES,
  OWNERSHIP_TYPES,
  LIFECYCLE_STATUSES,
  ILLUMINATION_OPTIONS,
  emptyFace,
  defaultBoardForm,
  parseLatLngInput,
  toBoardPayload,
  toFacePayloads,
  type BoardFormValues,
  type BoardFaceInput,
} from "@/lib/domain/board";

const inputClass =
  "rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

type Props = {
  organizationId: string;
  mode: "create" | "edit";
  boardId?: string;
  initial?: BoardFormValues;
  existingFaceIds?: string[];
  /** Sales never sees or edits floor / charges */
  showFloorRates?: boolean;
};

export function BoardForm({
  organizationId,
  mode,
  boardId,
  initial,
  existingFaceIds = [],
  showFloorRates = true,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<BoardFormValues>(initial ?? defaultBoardForm());
  const [mapsPaste, setMapsPaste] = useState("");
  const [retireReason, setRetireReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof BoardFormValues>(key: K, value: BoardFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function updateFace(index: number, patch: Partial<BoardFaceInput>) {
    setValues((v) => ({
      ...v,
      faces: v.faces.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
  }

  function applyMapsPaste() {
    const parsed = parseLatLngInput(mapsPaste);
    if (!parsed) {
      setError("Could not parse coordinates. Use lat,lng or a Google Maps link with @lat,lng.");
      return;
    }
    setError(null);
    setValues((v) => ({ ...v, lat: parsed.lat, lng: parsed.lng }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const payload = toBoardPayload(organizationId, values);

    if (!payload.board_code || !payload.name) {
      setLoading(false);
      setError("Board code and name are required.");
      return;
    }

    if (
      values.lifecycle_status === "retired" &&
      initial?.lifecycle_status !== "retired" &&
      !retireReason.trim()
    ) {
      setLoading(false);
      setError("Retiring a board requires a reason (never hard-delete).");
      return;
    }

    let id = boardId;

    if (mode === "create") {
      const { data: board, error: boardError } = await supabase
        .from("boards")
        .insert(payload)
        .select("id")
        .single();

      if (boardError || !board) {
        setLoading(false);
        setError(boardError?.message ?? "Could not create board");
        return;
      }
      id = board.id;

      await logActivity(supabase, {
        organizationId,
        entityType: "board",
        entityId: board.id,
        eventType: "board.created",
        boardId: board.id,
        toValue: {
          board_code: payload.board_code,
          name: payload.name,
        },
      });

      const faces = toFacePayloads(organizationId, board.id, values.faces);
      if (faces.length) {
        const { error: faceError } = await supabase.from("board_faces").insert(faces);
        if (faceError) {
          setLoading(false);
          setError(faceError.message);
          return;
        }
        await logActivity(supabase, {
          organizationId,
          entityType: "board",
          entityId: board.id,
          eventType: "face.created",
          boardId: board.id,
          toValue: { count: faces.length },
        });
      }
    } else {
      if (!id) {
        setLoading(false);
        setError("Missing board id");
        return;
      }

      const { organization_id: _omit, ...updateFields } = payload;
      const { error: cleanUpdError } = await supabase
        .from("boards")
        .update(updateFields)
        .eq("id", id);

      if (cleanUpdError) {
        setLoading(false);
        setError(cleanUpdError.message);
        return;
      }

      // Soft-replace faces: soft-delete old, insert new (simple V1 approach)
      if (existingFaceIds.length) {
        await supabase
          .from("board_faces")
          .update({
            deleted_at: new Date().toISOString(),
            deletion_reason: "replaced on edit",
          })
          .in("id", existingFaceIds);
      }

      const faces = toFacePayloads(organizationId, id, values.faces);
      if (faces.length) {
        const { error: faceError } = await supabase.from("board_faces").insert(faces);
        if (faceError) {
          setLoading(false);
          setError(faceError.message);
          return;
        }
      }

      await logActivity(supabase, {
        organizationId,
        entityType: "board",
        entityId: id,
        eventType:
          values.lifecycle_status === "retired" && initial?.lifecycle_status !== "retired"
            ? "board.retired"
            : "board.updated",
        boardId: id,
        reason:
          values.lifecycle_status === "retired" && retireReason.trim()
            ? retireReason.trim()
            : undefined,
        fromValue:
          values.lifecycle_status === "retired" && initial?.lifecycle_status !== "retired"
            ? { lifecycle_status: initial?.lifecycle_status }
            : undefined,
        toValue: {
          board_code: payload.board_code,
          name: payload.name,
          lifecycle_status: payload.lifecycle_status,
          faces: faces.length,
        },
      });
    }

    setLoading(false);
    router.push(`/manage/boards/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-6">
      <section className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-medium">Identity</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Board code</span>
            <input
              required
              placeholder="BLR-HSR-0142"
              value={values.board_code}
              onChange={(e) => setField("board_code", e.target.value)}
              className={inputClass}
              disabled={mode === "edit"}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Structure type</span>
            <select
              value={values.structure_type}
              onChange={(e) => setField("structure_type", e.target.value)}
              className={inputClass}
            >
              {STRUCTURE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Name</span>
          <input
            required
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Ownership</span>
            <select
              value={values.ownership_type}
              onChange={(e) => setField("ownership_type", e.target.value)}
              className={inputClass}
            >
              {OWNERSHIP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Installed on</span>
            <input
              type="date"
              value={values.installed_on}
              onChange={(e) => setField("installed_on", e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Ward / zone</span>
            <input
              value={values.ward_zone}
              onChange={(e) => setField("ward_zone", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Meter no.</span>
            <input
              value={values.meter_no}
              onChange={(e) => setField("meter_no", e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Street View URL</span>
          <input
            value={values.street_view_url}
            onChange={(e) => setField("street_view_url", e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Lifecycle</span>
          <select
            value={values.lifecycle_status}
            onChange={(e) =>
              setField("lifecycle_status", e.target.value as BoardFormValues["lifecycle_status"])
            }
            className={inputClass}
          >
            {LIFECYCLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {values.lifecycle_status === "retired" ? (
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Retire reason (required)</span>
            <textarea
              required={initial?.lifecycle_status !== "retired"}
              rows={2}
              value={retireReason}
              onChange={(e) => setRetireReason(e.target.value)}
              placeholder="Why is this structure being retired?"
              className={inputClass}
            />
            <span className="text-xs text-[var(--muted)]">
              Boards are never hard-deleted — retire with an audited reason.
            </span>
          </label>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-medium">Location & GPS</h2>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Paste Google Maps link or lat,lng</span>
          <div className="flex gap-2">
            <input
              value={mapsPaste}
              onChange={(e) => setMapsPaste(e.target.value)}
              placeholder="12.9716, 77.5946 or maps.google.com/..."
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={applyMapsPaste}
              className="rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--wash)]"
            >
              Apply
            </button>
          </div>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Latitude</span>
            <input
              value={values.lat}
              onChange={(e) => setField("lat", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Longitude</span>
            <input
              value={values.lng}
              onChange={(e) => setField("lng", e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Address</span>
          <input
            value={values.address_line}
            onChange={(e) => setField("address_line", e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Landmark</span>
            <input
              value={values.landmark}
              onChange={(e) => setField("landmark", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Road</span>
            <input
              value={values.road_name}
              onChange={(e) => setField("road_name", e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">City</span>
            <input
              value={values.city}
              onChange={(e) => setField("city", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">District</span>
            <input
              value={values.district}
              onChange={(e) => setField("district", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">State</span>
            <input
              value={values.state}
              onChange={(e) => setField("state", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">PIN</span>
            <input
              value={values.pin_code}
              onChange={(e) => setField("pin_code", e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">How to reach</span>
          <textarea
            rows={2}
            value={values.how_to_reach}
            onChange={(e) => setField("how_to_reach", e.target.value)}
            className={inputClass}
          />
        </label>
      </section>

      <section className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Faces</h2>
          <button
            type="button"
            onClick={() =>
              setValues((v) => ({
                ...v,
                faces: [
                  ...v.faces,
                  emptyFace(String.fromCharCode(65 + v.faces.length)),
                ],
              }))
            }
            className="text-sm text-[var(--accent)] hover:underline"
          >
            + Add face
          </button>
        </div>
        {values.faces.map((face, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-[var(--border)] p-3 sm:grid-cols-3"
          >
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Label</span>
              <input
                value={face.face_label}
                onChange={(e) => updateFace(index, { face_label: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Width (ft)</span>
              <input
                value={face.width_ft}
                onChange={(e) => updateFace(index, { width_ft: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Height (ft)</span>
              <input
                value={face.height_ft}
                onChange={(e) => updateFace(index, { height_ft: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Illumination</span>
              <select
                value={face.illumination}
                onChange={(e) => updateFace(index, { illumination: e.target.value })}
                className={inputClass}
              >
                {ILLUMINATION_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Facing</span>
              <input
                value={face.facing_direction}
                onChange={(e) => updateFace(index, { facing_direction: e.target.value })}
                placeholder="North"
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Card rate ₹/mo</span>
              <input
                value={face.card_rate_rupees}
                onChange={(e) => updateFace(index, { card_rate_rupees: e.target.value })}
                className={inputClass}
              />
            </label>
            {showFloorRates ? (
              <>
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--muted)]">Floor rate ₹/mo</span>
                  <input
                    value={face.floor_rate_rupees}
                    onChange={(e) =>
                      updateFace(index, { floor_rate_rupees: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--muted)]">Printing ₹</span>
                  <input
                    value={face.printing_charge_rupees}
                    onChange={(e) =>
                      updateFace(index, { printing_charge_rupees: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--muted)]">Mounting ₹</span>
                  <input
                    value={face.mounting_charge_rupees}
                    onChange={(e) =>
                      updateFace(index, { mounting_charge_rupees: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
              </>
            ) : null}
            {values.faces.length > 1 ? (
              <button
                type="button"
                className="text-left text-xs text-[var(--risk)] sm:col-span-3"
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    faces: v.faces.filter((_, i) => i !== index),
                  }))
                }
              >
                Remove face
              </button>
            ) : null}
          </div>
        ))}
      </section>

      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Saving…" : mode === "create" ? "Create board" : "Save changes"}
      </button>
    </form>
  );
}
