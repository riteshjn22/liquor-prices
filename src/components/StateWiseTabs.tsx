"use client";

import { useState } from "react";

export type VariantTable = {
  variant: string;
  sizes: { ml: number; label: string }[];
  rows: { slug: string; name: string; official: boolean; cells: (number | null)[] }[];
  truncated: boolean;
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/**
 * State × size price table with one tab per variant.
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
                  <th className="sticky left-0 bg-tile">State</th>
                  {t.sizes.map((s) => (
                    <th key={s.ml} className="whitespace-nowrap text-right">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.slug}>
                    <td className="sticky left-0 bg-white">
                      <a href={`#state-${r.slug}`} className="font-semibold text-link hover:underline">
                        {r.name}
                      </a>
                      {r.official && (
                        <span className="mt-0.5 block w-fit rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-green-700 sm:ml-1.5 sm:mt-0 sm:inline">
                          Official
                        </span>
                      )}
                    </td>
                    {r.cells.map((c, j) => (
                      <td key={t.sizes[j].ml} className="whitespace-nowrap text-right font-bold">
                        {c === null ? <span className="font-normal text-slate-300">—</span> : inr.format(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            {t.truncated && "Showing the most common sizes. "}
            Tap a state for every size.
          </p>
        </div>
      ))}
    </section>
  );
}
