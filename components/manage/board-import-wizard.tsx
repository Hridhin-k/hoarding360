"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { applyBoardImport } from "@/app/(manage)/manage/import/actions";
import {
  BOARD_IMPORT_HEADERS,
  SAMPLE_IMPORT_CSV,
  correctionCsv,
  fileHeadersFromMatrix,
  parseCsv,
  rowsToObjects,
  rowsToObjectsWithMapping,
  suggestColumnMapping,
  validateImportRows,
  type BoardImportHeader,
  type ValidatedImportRow,
} from "@/lib/domain/import-boards";

type Props = { organizationId: string };

function isSpreadsheet(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    n.endsWith(".xlsx") ||
    n.endsWith(".xls") ||
    n.endsWith(".ods") ||
    file.type.includes("spreadsheet") ||
    file.type.includes("excel")
  );
}

async function fileToMatrix(file: File): Promise<string[][]> {
  if (isSpreadsheet(file)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("Workbook has no sheets");
    const sheet = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    return raw.map((row) =>
      (Array.isArray(row) ? row : []).map((c) => String(c ?? "").trim()),
    );
  }
  const text = await file.text();
  return parseCsv(text);
}

export function BoardImportWizard({ organizationId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<BoardImportHeader, string>>>({});
  const [rows, setRows] = useState<ValidatedImportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    boardsCreated: number;
    facesCreated: number;
    skippedExisting: number;
  } | null>(null);

  const stats = useMemo(() => {
    const ok = rows.filter((r) => r.ok).length;
    const bad = rows.length - ok;
    return { ok, bad, total: rows.length };
  }, [rows]);

  function downloadTemplate() {
    const blob = new Blob([SAMPLE_IMPORT_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hoardings360-boards-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCorrections() {
    const csv = correctionCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hoardings360-import-corrections.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const parsed = await fileToMatrix(file);
      if (!parsed.length) throw new Error("File is empty");
      const headers = fileHeadersFromMatrix(parsed);
      const suggested = suggestColumnMapping(headers);
      setMatrix(parsed);
      setFileHeaders(headers);
      setMapping(suggested);

      // If all required headers already match, skip map step
      try {
        const objects = rowsToObjects(parsed);
        const validated = validateImportRows(objects);
        setRows(validated);
        setStep("preview");
      } catch {
        setStep("map");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse file");
    }
  }

  function applyMapping() {
    setError(null);
    try {
      const objects = rowsToObjectsWithMapping(matrix, mapping);
      const validated = validateImportRows(objects);
      setRows(validated);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mapping failed");
    }
  }

  async function onConfirm() {
    setLoading(true);
    setError(null);
    const res = await applyBoardImport(
      organizationId,
      rows.filter((r) => r.ok),
    );
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult({
      boardsCreated: res.boardsCreated,
      facesCreated: res.facesCreated,
      skippedExisting: res.skippedExisting,
    });
    setStep("done");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ol className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
        {["Upload", "Map columns", "Preview", "Done"].map((label, i) => {
          const keys = ["upload", "map", "preview", "done"] as const;
          const active = step === keys[i];
          return (
            <li
              key={label}
              className={`rounded-full px-3 py-1 ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--wash)] text-[var(--muted)]"
              }`}
            >
              {i + 1}. {label}
            </li>
          );
        })}
      </ol>

      {step === "upload" ? (
        <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm text-[var(--muted)]">
            M10 · Upload CSV or Excel (.xlsx / .xls). One row per face. Mismatched headers open
            the column map step.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
            >
              Download CSV template
            </button>
            <label className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
              Upload CSV / Excel
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
      ) : null}

      {step === "map" ? (
        <div className="space-y-4 rounded-lg border border-[var(--border)] bg-white p-6">
          <div>
            <h2 className="text-sm font-medium">Map your columns</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              M10 · Required: board_code, name, face_label
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {BOARD_IMPORT_HEADERS.map((field) => (
              <label key={field} className="grid gap-1 text-sm">
                <span className="text-[var(--muted)]">{field}</span>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))
                  }
                  className="rounded-md border border-[var(--border)] px-3 py-2"
                >
                  <option value="">— skip —</option>
                  {fileHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={applyMapping}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Continue to preview
          </button>
        </div>
      ) : null}

      {step === "preview" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              {stats.ok} valid · {stats.bad} need correction · {stats.total} total
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.bad > 0 ? (
                <button
                  type="button"
                  onClick={downloadCorrections}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                >
                  Download correction file
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setStep("upload");
                  setRows([]);
                  setMatrix([]);
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
                {loading ? "Importing…" : `Import ${stats.ok} valid rows`}
              </button>
            </div>
          </div>

          <div className="max-h-[28rem] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 bg-[var(--wash)] text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Face</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r._row}-${r.board_code}-${r.face_label}`}
                    className="border-t border-[var(--border)]"
                  >
                    <td className="px-3 py-2">{r._row}</td>
                    <td className="px-3 py-2">{r.board_code}</td>
                    <td className="px-3 py-2">{r.face_label}</td>
                    <td className="px-3 py-2">{r.city || "—"}</td>
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

      {step === "done" && result ? (
        <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="font-medium text-[var(--ink)]">Import complete</h2>
          <ul className="space-y-1 text-sm text-[var(--muted)]">
            <li>{result.boardsCreated} boards created</li>
            <li>{result.facesCreated} faces created</li>
            <li>{result.skippedExisting} existing board codes reused</li>
          </ul>
          <div className="flex gap-3 pt-2">
            <a
              href="/manage/boards"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              View boards
            </a>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}
    </div>
  );
}
