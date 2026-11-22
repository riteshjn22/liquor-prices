"use client";

import { useState } from "react";

export type VariantTable = {
  variant: string;
  sizes: { ml: number; label: string }[];
  rows: { slug: string; name: string; cells: (number | null)[] }[];
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/**
 * State × size price table with one tab per variant. This is the brand page's price list.
 * Every variant's table is in the server HTML (inactive ones are only hidden),
 * so search engines see all prices; tabs just switch which one is visible.
 */
export function StateWiseTabs({ brandName, tables }: { brandName: string; tables: VariantTable[] }) {
  const [active, setActive] = useState(0);
  const many = tables.length > 1;

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-bold">{brandName} Price State-wise</h2>
      {many && (
        <div role="tablist" aria-label={`${brandName} variants`} className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {tables.map((t, i) => (
            <button
              key={t.variant}
              id={`variant-tab-${i}`}
              role="tab"
              type="button"
              aria-selected={active === i}
              aria-controls={`variant-panel-${i}`}
              onClick={() => setActive(i)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                active === i ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-link"
              }`}
            >
              {t.variant}
            </button>
          ))}
        </div>
      )}
      {tables.map((t, i) => (
        <div
          key={t.variant}
          id={`variant-panel-${i}`}
          role={many ? "tabpanel" : undefined}
          aria-labelledby={many ? `variant-tab-${i}` : undefined}
          hidden={active !== i}
        >
          {many && <h3 className="sr-only">{`${brandName} ${t.variant}`}</h3>}
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="price-table [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-3 sm:[&_th]:px-3">
              <thead>
                <tr>
                  <th className="sticky left-0 w-36 bg-tile sm:w-56">State</th>
                  {t.sizes.map((s) => (
                    <th key={s.ml} className="whitespace-nowrap border-l border-line !text-left">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.slug}>
                    <td className="sticky left-0 bg-white">
                      <span className="font-semibold text-ink">{r.name}</span>
                    </td>
                    {r.cells.map((c, j) => (
                      <td key={t.sizes[j].ml} className="whitespace-nowrap border-l border-line text-left font-bold">
                        {c === null ? <span className="font-normal text-slate-300">—</span> : inr.format(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
