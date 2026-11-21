"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type BrandRow = {
  slug: string;
  name: string;
  refMrp: number;
  refSize: string;
  minMrp: number;
  maxMrp: number;
  sizes: string[];
  isCurrent: boolean;
  fy: string;
};

type Sort = "name" | "price-asc" | "price-desc";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const PAGE = 100;

function sizeOrder(label: string) {
  const n = parseFloat(label);
  return label.endsWith(" L") ? n * 1000 : n;
}

/**
 * The first 100 rows are server-rendered to keep the page light; the rest load
 * with "Show more". Every brand is still linked from the sitemap and from the
 * "similar brands" block on neighbouring brand pages.
 * Filters run in the browser and are mirrored to ?q=&size=&sort= for sharing;
 * those URLs keep the clean canonical, so they never compete in search.
 */
export function BrandTable({ basePath, rows }: { basePath: string; rows: BrandRow[] }) {
  const [q, setQ] = useState("");
  const [size, setSize] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [currentOnly, setCurrentOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [ready, setReady] = useState(false);

  const allSizes = useMemo(
    () => [...new Set(rows.flatMap((r) => r.sizes))].sort((a, b) => sizeOrder(a) - sizeOrder(b)),
    [rows],
  );

  // Restore filters from the URL once on the client.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from the URL after hydration */
    if (p.get("q")) setQ(p.get("q")!);
    if (p.get("size")) setSize(p.get("size")!);
    const s = p.get("sort");
    if (s === "price-asc" || s === "price-desc") setSort(s);
    if (p.get("current") === "1") setCurrentOnly(true);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Mirror filters to the URL without adding history entries.
  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (size) p.set("size", size);
    if (sort !== "name") p.set("sort", sort);
    if (currentOnly) p.set("current", "1");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [q, size, sort, currentOnly, ready]);

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let list = rows.filter(
      (r) =>
        (!size || r.sizes.includes(size)) &&
        (!currentOnly || r.isCurrent) &&
        words.every((w) => r.name.toLowerCase().includes(w)),
    );
    if (sort === "price-asc") list = [...list].sort((a, b) => a.refMrp - b.refMrp);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.refMrp - a.refMrp);
    return list;
  }, [rows, q, size, sort, currentOnly]);

  const visible = filtered.slice(0, limit);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 rounded-t-xl border border-b-0 border-slate-200 bg-white p-4">
        <label className="flex flex-col text-xs font-medium text-slate-600">
          Brand
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name"
            className="mt-1 w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900 outline-none focus:border-amber-600"
          />
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-600">
          Size
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900"
          >
            <option value="">All sizes</option>
            {allSizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-600">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900"
          >
            <option value="name">Name (A–Z)</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm text-slate-700">
          <input type="checkbox" checked={currentOnly} onChange={(e) => setCurrentOnly(e.target.checked)} />
          Current year only
        </label>
        <span className="ml-auto pb-1.5 text-sm text-slate-500">
          {filtered.length.toLocaleString("en-IN")} of {rows.length.toLocaleString("en-IN")} brands
        </span>
      </div>
      <div className="overflow-x-auto rounded-b-xl border border-slate-200 bg-white">
        <table className="price-table">
          <thead>
            <tr>
              <th>Brand</th>
              <th className="text-right">MRP</th>
              <th className="hidden sm:table-cell">Price range</th>
              <th className="hidden md:table-cell">Sizes</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.slug}>
                <td>
                  <Link href={`${basePath}/${r.slug}`} className="font-medium text-slate-900 hover:text-amber-700 hover:underline">
                    {r.name}
                  </Link>
                  {!r.isCurrent && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">FY {r.fy}</span>}
                </td>
                <td className="whitespace-nowrap text-right">
                  <span className="font-semibold">{inr.format(r.refMrp)}</span>
                  <span className="block text-xs text-slate-500">{r.refSize}</span>
                </td>
                <td className="hidden whitespace-nowrap text-slate-600 sm:table-cell">
                  {r.minMrp === r.maxMrp ? inr.format(r.minMrp) : `${inr.format(r.minMrp)} – ${inr.format(r.maxMrp)}`}
                </td>
                <td className="hidden text-slate-600 md:table-cell">{r.sizes.join(", ")}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  No brands match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > limit && (
        <button
          onClick={() => setLimit(limit + PAGE)}
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Show more ({(filtered.length - limit).toLocaleString("en-IN")} left)
        </button>
      )}
    </div>
  );
}
