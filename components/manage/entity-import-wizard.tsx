"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  applyAgreementImport,
  applyClientImport,
  applyPermitImport,
} from "@/app/(manage)/manage/import/actions";
import { parseCsv } from "@/lib/domain/import-boards";
import {
  AGREEMENT_IMPORT_HEADERS,
  CLIENT_IMPORT_HEADERS,
  PERMIT_IMPORT_HEADERS,
  SAMPLE_AGREEMENT_CSV,
  SAMPLE_CLIENT_CSV,
  SAMPLE_PERMIT_CSV,
  matrixToObjects,
  validateAgreementRows,
  validateClientRows,
  validatePermitRows,
  type GenericValidatedRow,
  type ImportEntityKind,
} from "@/lib/domain/import-entities";

type Props = { organizationId: string; kind: Exclude<ImportEntityKind, "boards"> };

async function fileToMatrix(file: File): Promise<string[][]> {
  const n = file.name.toLowerCase();
  if (n.endsWith(".xlsx") || n.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    const raw = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    return raw.map((row) =>
      (Array.isArray(row) ? row : []).map((c) => String(c ?? "").trim()),
    );
  }
  return parseCsv(await file.text());
}

function config(kind: Props["kind"]) {
  if (kind === "clients") {
    return {
      headers: CLIENT_IMPORT_HEADERS,
      sample: SAMPLE_CLIENT_CSV,
      required: ["name"] as const,
      validate: validateClientRows,
      label: "Clients",
    };
  }
  if (kind === "agreements") {
    return {
      headers: AGREEMENT_IMPORT_HEADERS,
      sample: SAMPLE_AGREEMENT_CSV,
      required: ["client_name", "board_code", "face_label", "starts_on", "ends_on"] as const,
      validate: validateAgreementRows,
      label: "Agreements",
    };
  }
  return {
    headers: PERMIT_IMPORT_HEADERS,
    sample: SAMPLE_PERMIT_CSV,
    required: ["board_code", "clearance_type", "governing_body"] as const,
    validate: validatePermitRows,
    label: "Permits",
  };
}

export function EntityImportWizard({ organizationId, kind }: Props) {
  const router = useRouter();
  const cfg = config(kind);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [rows, setRows] = useState<GenericValidatedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const stats = useMemo(() => {
    const ok = rows.filter((r) => r.ok).length;
    return { ok, bad: rows.length - ok, total: rows.length };
  }, [rows]);

  function downloadTemplate() {
    const blob = new Blob([cfg.sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hoardings360-${kind}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const matrix = await fileToMatrix(file);
      const { objects } = matrixToObjects(matrix, cfg.required);
      setRows(cfg.validate(objects));
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    }
  }

  async function onConfirm() {
    setLoading(true);
    setError(null);
    const valid = rows.filter((r) => r.ok);
    try {
      if (kind === "clients") {
        const res = await applyClientImport(organizationId, valid);
        if (!res.ok) throw new Error(res.error);
        setSummary(`${res.created} created · ${res.skipped} skipped (name exists)`);
      } else if (kind === "agreements") {
        const res = await applyAgreementImport(organizationId, valid);
        if (!res.ok) throw new Error(res.error);
        setSummary(
          `${res.created} face lines · ${res.failed} failed${
            res.errors.length ? ` · ${res.errors.slice(0, 3).join("; ")}` : ""
          }`,
        );
      } else {
        const res = await applyPermitImport(organizationId, valid);
        if (!res.ok) throw new Error(res.error);
        setSummary(`${res.created} permits · ${res.skipped} skipped (board missing)`);
      }
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {step === "upload" ? (
        <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm text-[var(--muted)]">
            M10 · {cfg.label} · CSV or Excel · required: {cfg.required.join(", ")}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
            >
              Download template
            </button>
            <label className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
              Upload file
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
      ) : null}

      {step === "preview" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              {stats.ok} valid · {stats.bad} need fix · {stats.total} total
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("upload");
                  setRows([]);
                }}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              >
                Re-upload
              </button>
              <button
                type="button"
                disabled={loading || stats.ok === 0}
                onClick={() => void onConfirm()}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {loading ? "Importing…" : `Import ${stats.ok}`}
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-auto rounded-lg border border-[var(--border)] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--wash)] text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Preview</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._row} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">{r._row}</td>
                    <td className="px-3 py-2">
                      {Object.entries(r.raw)
                        .filter(([k]) => k !== "_row")
                        .slice(0, 4)
                        .map(([, v]) => v)
                        .join(" · ")}
                    </td>
                    <td className="px-3 py-2">
                      {r.ok ? (
                        <span className="text-[var(--ok)]">OK</span>
                      ) : (
                        <span className="text-[var(--risk)]">{r.errors.join("; ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="font-medium">Import complete</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{summary}</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}
    </div>
  );
}
