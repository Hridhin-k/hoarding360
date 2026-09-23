import { formatInrFromPaise } from "@/lib/format";

export type RateHistoryRow = {
  id: string;
  face_id: string;
  card_rate_paise: number | null;
  floor_rate_paise: number | null;
  printing_charge_paise: number | null;
  mounting_charge_paise: number | null;
  reason: string | null;
  occurred_at: string;
  face_label?: string;
};

type Props = {
  rows: RateHistoryRow[];
  showFloor: boolean;
};

export function FaceRateHistory({ rows, showFloor }: Props) {
  if (!rows.length) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
        No rate changes recorded yet. Saving face rates creates history automatically.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-xs uppercase tracking-wide text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3 font-medium">When</th>
            <th className="px-4 py-3 font-medium">Face</th>
            <th className="px-4 py-3 font-medium">Card</th>
            {showFloor ? (
              <>
                <th className="px-4 py-3 font-medium">Floor</th>
                <th className="px-4 py-3 font-medium">Print</th>
                <th className="px-4 py-3 font-medium">Mount</th>
              </>
            ) : null}
            <th className="px-4 py-3 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
              <td className="px-4 py-3 text-xs text-[var(--muted)]">
                {new Date(r.occurred_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}
              </td>
              <td className="px-4 py-3">{r.face_label ?? "—"}</td>
              <td className="px-4 py-3">{formatInrFromPaise(r.card_rate_paise)}</td>
              {showFloor ? (
                <>
                  <td className="px-4 py-3">{formatInrFromPaise(r.floor_rate_paise)}</td>
                  <td className="px-4 py-3">
                    {formatInrFromPaise(r.printing_charge_paise)}
                  </td>
                  <td className="px-4 py-3">
                    {formatInrFromPaise(r.mounting_charge_paise)}
                  </td>
                </>
              ) : null}
              <td className="px-4 py-3 text-[var(--muted)]">{r.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
