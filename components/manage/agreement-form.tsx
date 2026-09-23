"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PendingButton, btnPrimary } from "@/components/ui/pending-button";
import { createClient } from "@/lib/supabase/browser";
import { logActivity } from "@/lib/domain/activity";
import { formatInrFromPaise } from "@/lib/format";

const inputClass =
  "rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

type FaceOption = {
  id: string;
  face_label: string;
  card_rate_paise: number | null;
  board_id: string;
  board_code: string;
  board_name: string;
  occupancy_status: string;
};

type ClientOption = { id: string; name: string };

type Line = {
  face_id: string;
  rate_rupees: string;
  starts_on: string;
  ends_on: string;
};

type Props = {
  organizationId: string;
  clients: ClientOption[];
  faces: FaceOption[];
  defaultClientId?: string;
  defaultFaceId?: string;
};

export function AgreementForm({
  organizationId,
  clients,
  faces,
  defaultClientId,
  defaultFaceId,
}: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaultClientId ?? clients[0]?.id ?? "");
  const [refCode, setRefCode] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [lines, setLines] = useState<Line[]>([
    {
      face_id: defaultFaceId ?? "",
      rate_rupees: "",
      starts_on: "",
      ends_on: "",
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const faceMap = useMemo(() => new Map(faces.map((f) => [f.id, f])), [faces]);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId || !startsOn || !endsOn) {
      setError("Client and agreement dates are required.");
      return;
    }
    if (endsOn < startsOn) {
      setError("Agreement end date must be on or after start date.");
      return;
    }

    const validLines = lines.filter((l) => l.face_id);
    if (!validLines.length) {
      setError("Add at least one face.");
      return;
    }

    for (const l of validLines) {
      const s = l.starts_on || startsOn;
      const en = l.ends_on || endsOn;
      if (en < s) {
        setError("A face line has end before start.");
        return;
      }
    }

    setLoading(true);
    const supabase = createClient();

    const valuePaise = validLines.reduce((sum, l) => {
      const rate =
        l.rate_rupees.trim() !== ""
          ? Number(l.rate_rupees)
          : (faceMap.get(l.face_id)?.card_rate_paise ?? 0) / 100;
      return sum + Math.round((Number.isNaN(rate) ? 0 : rate) * 100);
    }, 0);

    const { data: agreement, error: agrError } = await supabase
      .from("agreements")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        ref_code: refCode.trim() || null,
        starts_on: startsOn,
        ends_on: endsOn,
        value_paise: valuePaise,
        status: "active",
      })
      .select("id")
      .single();

    if (agrError || !agreement) {
      setLoading(false);
      setError(agrError?.message ?? "Could not create agreement");
      return;
    }

    const faceRows = validLines.map((l) => {
      const rateRupees =
        l.rate_rupees.trim() !== ""
          ? Number(l.rate_rupees)
          : (faceMap.get(l.face_id)?.card_rate_paise ?? 0) / 100;
      return {
        organization_id: organizationId,
        agreement_id: agreement.id,
        face_id: l.face_id,
        rate_paise: Math.round((Number.isNaN(rateRupees) ? 0 : rateRupees) * 100),
        starts_on: l.starts_on || startsOn,
        ends_on: l.ends_on || endsOn,
      };
    });

    const { error: faceError } = await supabase.from("agreement_faces").insert(faceRows);

    if (faceError) {
      setLoading(false);
      // Surface overlap errors clearly
      const msg = faceError.message.includes("Overlapping")
        ? faceError.message
        : faceError.message;
      // Roll back agreement shell
      await supabase
        .from("agreements")
        .update({
          deleted_at: new Date().toISOString(),
          deletion_reason: "face insert failed",
          status: "cancelled",
        })
        .eq("id", agreement.id);
      setError(msg);
      return;
    }

    const boardIds = [
      ...new Set(
        validLines
          .map((l) => faceMap.get(l.face_id)?.board_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    for (const boardId of boardIds.length ? boardIds : [null]) {
      await logActivity(supabase, {
        organizationId,
        entityType: "agreement",
        entityId: agreement.id,
        eventType: "agreement.created",
        boardId,
        toValue: {
          ref_code: refCode.trim() || null,
          client_id: clientId,
          faces: validLines.length,
          starts_on: startsOn,
          ends_on: endsOn,
        },
      });
    }

    setLoading(false);
    router.push(`/manage/agreements/${agreement.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-4">
      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Client</span>
        <select
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className={inputClass}
        >
          <option value="">Select client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-[var(--muted)]">Agreement ref (optional)</span>
        <input
          value={refCode}
          onChange={(e) => setRefCode(e.target.value)}
          placeholder="AGR-2026-001"
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Starts</span>
          <input
            type="date"
            required
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Ends</span>
          <input
            type="date"
            required
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Faces</h3>
          <button
            type="button"
            className="text-sm text-[var(--accent)]"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { face_id: "", rate_rupees: "", starts_on: "", ends_on: "" },
              ])
            }
          >
            + Add face
          </button>
        </div>
        {lines.map((line, i) => {
          const face = faceMap.get(line.face_id);
          return (
            <div key={i} className="grid gap-2 border-t border-[var(--border)] pt-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--muted)]">Face</span>
                <select
                  required
                  value={line.face_id}
                  onChange={(e) => {
                    const f = faceMap.get(e.target.value);
                    updateLine(i, {
                      face_id: e.target.value,
                      rate_rupees:
                        f?.card_rate_paise != null
                          ? String(Math.round(f.card_rate_paise / 100))
                          : line.rate_rupees,
                    });
                  }}
                  className={inputClass}
                >
                  <option value="">Select face…</option>
                  {faces.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.board_code} · {f.face_label} ({f.occupancy_status}) —{" "}
                      {formatInrFromPaise(f.card_rate_paise)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-[var(--muted)]">Rate ₹/mo</span>
                <input
                  value={line.rate_rupees}
                  onChange={(e) => updateLine(i, { rate_rupees: e.target.value })}
                  placeholder={
                    face?.card_rate_paise != null
                      ? String(Math.round(face.card_rate_paise / 100))
                      : ""
                  }
                  className={inputClass}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--muted)]">Face start</span>
                  <input
                    type="date"
                    value={line.starts_on}
                    onChange={(e) => updateLine(i, { starts_on: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--muted)]">Face end</span>
                  <input
                    type="date"
                    value={line.ends_on}
                    onChange={(e) => updateLine(i, { ends_on: e.target.value })}
                    className={inputClass}
                  />
                </label>
              </div>
              {lines.length > 1 ? (
                <button
                  type="button"
                  className="text-left text-xs text-[var(--risk)] sm:col-span-2"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove line
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}

      <PendingButton
        type="submit"
        pending={loading}
        pendingLabel="Saving…"
        disabled={!clients.length || !faces.length}
        className={btnPrimary}
      >
        Create agreement
      </PendingButton>
      {!clients.length ? (
        <p className="text-xs text-[var(--muted)]">Create a client first.</p>
      ) : null}
      {!faces.length ? (
        <p className="text-xs text-[var(--muted)]">Add a board with faces first.</p>
      ) : null}
    </form>
  );
}
