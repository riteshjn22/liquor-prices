"use client";

import { useState } from "react";

type Issue = { sheet: string; row: number; message: string };
type Change = { key: string; brand: string; field: string; from: string; to: string };
type Result = {
  mode: "preview" | "apply";
  fileName: string;
  brandRows: number;
  priceRows: number;
  brandsChanged: number;
  totalChanges: number;
  changes: Change[];
  errors: Issue[];
  totalErrors: number;
  warnings: Issue[];
  applied: boolean;
  error?: string;
};

export function AdminPanel({ states }: { states: { slug: string; name: string }[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(mode: "preview" | "apply") {
    if (!file) return;
    setBusy(mode);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("mode", mode);
      const res = await fetch("/api/admin/import", { method: "POST", body });
      const json = (await res.json().catch(() => ({ error: `Server returned HTTP ${res.status}` }))) as Partial<Result>;
      if (json.mode) setResult(json as Result);
      if (json.error) setError(json.error);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const canApply = result && result.mode === "preview" && result.totalErrors === 0 && result.totalChanges > 0;

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-bold text-slate-900">1. Download the Excel file</h2>
        <p className="mt-1 text-sm text-slate-600">
          Every brand with its official data and your current edits. Edit only the yellow columns.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {states.map((s) => (
            <a
              key={s.slug}
              href={`/api/admin/export?state=${s.slug}`}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
            >
              ⬇ Download {s.name} Excel
            </a>
          ))}
          {states.length > 1 && (
            <a href="/api/admin/export" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              ⬇ All states
            </a>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-slate-900">2. Upload your edited file</h2>
        <p className="mt-1 text-sm text-slate-600">You will see every change first. Nothing is saved until you press Apply.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError(null);
            }}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-white"
          />
          <button
            disabled={!file || busy !== null}
            onClick={() => send("preview")}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy === "preview" ? "Checking…" : "Preview changes"}
          </button>
          {canApply && (
            <button
              disabled={busy !== null}
              onClick={() => send("apply")}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-40"
            >
              {busy === "apply" ? "Saving…" : `Apply ${result.totalChanges} change${result.totalChanges === 1 ? "" : "s"}`}
            </button>
          )}
        </div>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

        {result && (
          <div className="mt-5 space-y-4 text-sm">
            {result.applied ? (
              <p className="rounded-md bg-green-50 px-3 py-2 font-medium text-green-800">
                ✓ Saved {result.totalChanges} changes to {result.brandsChanged} brands. The site is refreshed: changed pages
                update on their next visit.
              </p>
            ) : (
              <p className="text-slate-700">
                <b>{result.fileName}</b>: read {result.brandRows.toLocaleString("en-IN")} brand rows and{" "}
                {result.priceRows.toLocaleString("en-IN")} price rows.{" "}
                {result.totalChanges === 0 ? (
                  <b>No changes found.</b>
                ) : (
                  <b>
                    {result.totalChanges} change{result.totalChanges === 1 ? "" : "s"} across {result.brandsChanged} brand
                    {result.brandsChanged === 1 ? "" : "s"}.
                  </b>
                )}
              </p>
            )}

            {result.totalErrors > 0 && (
              <IssueTable title={`${result.totalErrors} error${result.totalErrors === 1 ? "" : "s"}: fix these in Excel and upload again`} tone="red" issues={result.errors} />
            )}
            {result.warnings.length > 0 && <IssueTable title="Warnings (you can still apply)" tone="amber" issues={result.warnings} />}

            {result.changes.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="price-table">
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Field</th>
                      <th>Before</th>
                      <th>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.changes.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <a href={`/prices/${c.key}`} target="_blank" rel="noopener" className="text-slate-900 hover:underline">
                            {c.brand}
                          </a>
                        </td>
                        <td className="whitespace-nowrap text-slate-600">{c.field}</td>
                        <td className="text-slate-500">{c.from}</td>
                        <td className="font-medium text-slate-900">{c.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.totalChanges > result.changes.length && (
                  <p className="px-3 py-2 text-xs text-slate-500">Showing the first {result.changes.length} of {result.totalChanges} changes.</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function IssueTable({ title, tone, issues }: { title: string; tone: "red" | "amber"; issues: Issue[] }) {
  const color = tone === "red" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`rounded-lg border px-3 py-2 ${color}`}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 max-h-60 list-disc space-y-0.5 overflow-y-auto pl-5">
        {issues.map((e, i) => (
          <li key={i}>
            {e.sheet} sheet, row {e.row}: {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
