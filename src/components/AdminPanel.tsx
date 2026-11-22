"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Category = { slug: string; name: string };
type BrandRow = { key: string; category: string; name: string; enabled: boolean; featured: boolean; priceText: string; priceNote: string; products: number; statePrices: number };

/** How many popular brands the home page shows (see getPopularBrands). */
const HOME_POPULAR_LIMIT = 12;

type Issue = { sheet: string; row: number; message: string };
type Change = { key: string; brand: string; field: string; from: string; to: string };
type Result = {
  mode: "preview" | "apply";
  fileName: string;
  format: "workbook" | "brand-list";
  rows: { brands: number; statePrices: number; products: number };
  newBrands: number;
  totalChanges: number;
  changes: Change[];
  errors: Issue[];
  totalErrors: number;
  warnings: Issue[];
  applied: boolean;
  productsMatched?: number;
  error?: string;
};

export function AdminPanel({ categories }: { categories: Category[] }) {
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <div className="space-y-6">
      <BrandManager categories={categories} reloadKey={reloadKey} />
      <ExcelSection onApplied={() => setReloadKey((k) => k + 1)} />
    </div>
  );
}

// ---------------------------------------------------------------- brand on/off

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${on ? "bg-green-600" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function BrandManager({ categories, reloadKey }: { categories: Category[]; reloadKey: number }) {
  const [brands, setBrands] = useState<BrandRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState<"" | "on" | "off" | "popular">("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/brands", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBrands(((await res.json()) as { brands: BrandRow[] }).brands);
      setError(null);
    } catch (e) {
      setError(`Could not load brands: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and after an Excel upload
    void load();
  }, [load, reloadKey]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (brands ?? []).filter(
      (b) =>
        (!cat || b.category === cat) &&
        (!status || (status === "popular" ? b.featured : (status === "on") === b.enabled)) &&
        words.every((w) => b.name.toLowerCase().includes(w) || b.key.includes(w)),
    );
  }, [brands, q, cat, status]);

  async function update(keys: string[], patch: { enabled: boolean } | { featured: boolean }) {
    if (!keys.length || !brands) return;
    const before = brands;
    setBrands(brands.map((b) => (keys.includes(b.key) ? { ...b, ...patch } : b))); // optimistic
    setSaving(true);
    try {
      const res = await fetch("/api/admin/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys, ...patch }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setError(null);
    } catch (e) {
      setBrands(before);
      setError(`Could not save: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const setEnabled = (keys: string[], enabled: boolean) => update(keys, { enabled });
  const setFeatured = (keys: string[], featured: boolean) => update(keys, { featured });
  const enabledCount = brands?.filter((b) => b.enabled).length ?? 0;
  const popular = brands?.filter((b) => b.featured && b.enabled) ?? [];
  const allShownSelected = shown.length > 0 && shown.every((b) => selected.has(b.key));
  const targetKeys = selected.size ? [...selected] : shown.map((b) => b.key);

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Brands on the site</h2>
        {brands && (
          <span className="text-sm text-muted">
            <b className="text-green-700">{enabledCount}</b> enabled · {brands.length - enabledCount} disabled · {brands.length} total
            {saving && " · saving…"}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Only enabled brands appear on the website and in the sitemap. Changes are live immediately.</p>
      {brands && (
        <p className={`mt-2 rounded-md px-3 py-2 text-sm ${popular.length ? "bg-amber-50 text-amber-900" : "bg-tile text-muted"}`}>
          {popular.length ? (
            <>
              <b>★ {popular.length} popular brand{popular.length === 1 ? "" : "s"}</b> on the home page
              {popular.length > HOME_POPULAR_LIMIT && ` (the first ${HOME_POPULAR_LIMIT} A–Z are shown)`}. Unmark them all to go back to the automatic list.
            </>
          ) : (
            <>No brands marked ★ Popular, so the home page picks them automatically (brands with the most Delhi variants). Click a ★ to choose your own.</>
          )}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brands" className="w-56 rounded-lg border border-line px-3 py-1.5 text-sm" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-line px-2 py-1.5 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as "" | "on" | "off" | "popular")} className="rounded-lg border border-line px-2 py-1.5 text-sm">
          <option value="">Enabled and disabled</option>
          <option value="on">Enabled only</option>
          <option value="off">Disabled only</option>
          <option value="popular">★ Popular only</option>
        </select>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => setEnabled(targetKeys, true)} disabled={!shown.length || saving} className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
            Enable {selected.size ? `${selected.size} selected` : `all ${shown.length} shown`}
          </button>
          <button onClick={() => setEnabled(targetKeys, false)} disabled={!shown.length || saving} className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
            Disable {selected.size ? `${selected.size} selected` : `all ${shown.length} shown`}
          </button>
          {selected.size > 0 && (
            <>
              <button onClick={() => setFeatured([...selected], true)} disabled={saving} className="rounded-lg bg-gold px-3 py-1.5 text-sm font-bold text-navy disabled:opacity-40">
                ★ Mark {selected.size} popular
              </button>
              <button onClick={() => setFeatured([...selected], false)} disabled={saving} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink disabled:opacity-40">
                Unmark {selected.size}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {!brands && !error && <p className="mt-4 text-sm text-muted">Loading brands…</p>}
      {brands && brands.length === 0 && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No brands yet. Upload your brand list Excel below (sheets like “Whiskies”, “Beers” with a Brand column) to create them.
        </p>
      )}

      {brands && brands.length > 0 && (
        <div className="mt-4 max-h-[560px] overflow-auto rounded-xl border border-line">
          <table className="price-table">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all shown"
                    checked={allShownSelected}
                    onChange={(e) => setSelected(e.target.checked ? new Set([...selected, ...shown.map((b) => b.key)]) : new Set([...selected].filter((k) => !shown.some((b) => b.key === k))))}
                  />
                </th>
                <th>On</th>
                <th title="Shown in Popular Brands on the home page">Popular</th>
                <th>Brand</th>
                <th className="hidden sm:table-cell">Category</th>
                <th className="hidden md:table-cell">Price range</th>
                <th className="text-right" title="Delhi excise products matched to this brand">
                  Delhi
                </th>
                <th className="text-right" title="Prices you added for other states">
                  States
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.key} className={b.enabled ? "" : "text-muted"}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${b.name}`}
                      checked={selected.has(b.key)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(b.key);
                        else next.delete(b.key);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td>
                    <Toggle on={b.enabled} onChange={(v) => setEnabled([b.key], v)} label={`${b.enabled ? "Disable" : "Enable"} ${b.name}`} />
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-pressed={b.featured}
                      aria-label={`${b.featured ? "Remove" : "Mark"} ${b.name} ${b.featured ? "from" : "as"} popular`}
                      title={b.enabled ? (b.featured ? "Popular: shown on the home page" : "Mark as popular") : "Enable the brand to show it on the home page"}
                      onClick={() => setFeatured([b.key], !b.featured)}
                      className={`text-xl leading-none transition ${b.featured ? "text-gold" : "text-slate-300 hover:text-gold"}`}
                    >
                      {b.featured ? "★" : "☆"}
                    </button>
                  </td>
                  <td>
                    {b.enabled ? (
                      <a href={`/prices/${b.key}`} target="_blank" rel="noopener" className="font-semibold text-ink hover:text-link hover:underline">
                        {b.name}
                      </a>
                    ) : (
                      <span className="font-semibold">{b.name}</span>
                    )}
                    <span className="block text-xs text-muted">{b.key}</span>
                  </td>
                  <td className="hidden sm:table-cell">{b.category}</td>
                  <td className="hidden whitespace-nowrap md:table-cell">
                    {b.priceText || <span className="text-slate-400">—</span>}
                    {b.priceNote && <span className="block text-xs text-muted">{b.priceNote}</span>}
                  </td>
                  <td className="text-right">{b.products || <span className="text-slate-300">0</span>}</td>
                  <td className="text-right">{b.statePrices || <span className="text-slate-300">0</span>}</td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted">
                    No brands match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {selected.size > 0 && (
        <button onClick={() => setSelected(new Set())} className="mt-2 text-sm text-link hover:underline">
          Clear selection ({selected.size})
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Excel

function ExcelSection({ onApplied }: { onApplied: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [fullList, setFullList] = useState(false);
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
      if (fullList) body.set("fullList", "1");
      const res = await fetch("/api/admin/import", { method: "POST", body });
      const json = (await res.json().catch(() => ({ error: `Server returned HTTP ${res.status}` }))) as Partial<Result>;
      if (json.mode) setResult(json as Result);
      if (json.error) setError(json.error);
      if (json.applied) onApplied();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const canApply = result && result.mode === "preview" && result.totalErrors === 0 && result.totalChanges > 0;

  return (
    <>
      <section className="card">
        <h2 className="text-lg font-bold">Download Excel</h2>
        <p className="mt-1 text-sm text-muted">
          Brands, state prices and Delhi product matching in one file. Edit the yellow columns, then upload it below.
        </p>
        <a href="/api/admin/export" className="mt-4 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600">
          ⬇ Download Excel
        </a>
      </section>

      <section className="card">
        <h2 className="text-lg font-bold">Upload Excel</h2>
        <p className="mt-1 text-sm text-muted">
          Upload an edited file from “Download Excel”, or a brand list (sheets like “Whiskies”, “Beers” with Brand and Price
          columns) to add brands. Enter state prices in the “Prices by state” sheet: add a column named after a state (e.g.
          Haryana) and type the prices. You will see every change first; nothing is saved until you press Apply.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError(null);
            }}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-2 file:text-white"
          />
          <button disabled={!file || busy !== null} onClick={() => send("preview")} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {busy === "preview" ? "Checking…" : "Preview changes"}
          </button>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={fullList}
              onChange={(e) => {
                setFullList(e.target.checked);
                setResult(null);
              }}
            />
            Full brand list: switch off brands that aren&apos;t in this file
          </label>
          {canApply && (
            <button disabled={busy !== null} onClick={() => send("apply")} className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy disabled:opacity-40">
              {busy === "apply" ? "Saving…" : `Apply ${result.totalChanges} change${result.totalChanges === 1 ? "" : "s"}`}
            </button>
          )}
        </div>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

        {result && (
          <div className="mt-5 space-y-4 text-sm">
            {result.applied ? (
              <p className="rounded-md bg-green-50 px-3 py-2 font-medium text-green-800">
                ✓ Saved {result.totalChanges} changes{result.newBrands ? ` (${result.newBrands} new brands)` : ""}.
                {result.productsMatched !== undefined && ` ${result.productsMatched} Delhi products are matched to brands.`} The site is updated.
              </p>
            ) : (
              <p>
                <b>{result.fileName}</b>
                {result.format === "brand-list" ? " (brand list)" : ""}: read {result.rows.brands} brand rows
                {result.format === "workbook" && `, ${result.rows.statePrices} price rows and ${result.rows.products} Delhi product rows`}.{" "}
                {result.totalChanges === 0 ? (
                  <b>No changes found.</b>
                ) : (
                  <b>
                    {result.totalChanges} change{result.totalChanges === 1 ? "" : "s"}
                    {result.newBrands ? `, including ${result.newBrands} new brands` : ""}.
                  </b>
                )}
              </p>
            )}

            {result.totalErrors > 0 && <IssueList title={`${result.totalErrors} error${result.totalErrors === 1 ? "" : "s"}: fix these in Excel and upload again`} tone="red" issues={result.errors} />}
            {result.warnings.length > 0 && <IssueList title="Warnings (you can still apply)" tone="amber" issues={result.warnings} />}

            {result.changes.length > 0 && (
              <div className="max-h-[480px] overflow-auto rounded-lg border border-line">
                <table className="price-table">
                  <thead className="sticky top-0">
                    <tr>
                      <th>Brand / product</th>
                      <th>Change</th>
                      <th>Before</th>
                      <th>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.changes.map((c, i) => (
                      <tr key={i}>
                        <td>
                          {c.brand}
                          <span className="block text-xs text-muted">{c.key}</span>
                        </td>
                        <td className="whitespace-nowrap text-muted">{c.field}</td>
                        <td className="text-muted">{c.from}</td>
                        <td className="font-medium">{c.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.totalChanges > result.changes.length && <p className="px-3 py-2 text-xs text-muted">Showing the first {result.changes.length} of {result.totalChanges} changes.</p>}
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function IssueList({ title, tone, issues }: { title: string; tone: "red" | "amber"; issues: Issue[] }) {
  const color = tone === "red" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`rounded-lg border px-3 py-2 ${color}`}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 max-h-60 list-disc space-y-0.5 overflow-y-auto pl-5">
        {issues.map((e, i) => (
          <li key={i}>
            {e.sheet !== "-" && `${e.sheet} sheet${e.row > 0 ? `, row ${e.row}` : ""}: `}
            {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
