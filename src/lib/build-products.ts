import type { PricePoint, PriceRow, ProductDoc, SizePrice } from "./types";
import { slugify } from "./normalize";

/** Official product data from the excise list. Brand assignment fields are added later and never overwritten here. */
export type ProductData = Omit<ProductDoc, "createdAt" | "updatedAt" | "priceChangedAt" | "brandKey" | "autoBrandKey" | "brandOverride" | "label">;

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0] ?? "";
  let bestCount = 0;
  for (const [v, c] of counts) if (c > bestCount) [best, bestCount] = [v, c];
  return best;
}

const unique = <T,>(values: T[]) => [...new Set(values)];

/** Sort key: financial year, then the date the price became valid. */
function compareRows(a: PriceRow, b: PriceRow): number {
  return (
    a.fy.localeCompare(b.fy) ||
    (a.validFrom ?? "").localeCompare(b.validFrom ?? "") ||
    a.mrp - b.mrp
  );
}

function buildHistory(sorted: PriceRow[]): PricePoint[] {
  const points: PricePoint[] = [];
  for (const r of sorted) {
    const last = points[points.length - 1];
    if (last && last.mrp === r.mrp) {
      // Same price carried forward: extend the validity window.
      if ((r.validTo ?? "") > (last.validTo ?? "")) last.validTo = r.validTo;
      last.fy = r.fy;
      continue;
    }
    points.push({ fy: r.fy, validFrom: r.validFrom, validTo: r.validTo, mrp: r.mrp });
  }
  return points;
}

const PREFERRED_REF_ML = [750, 700, 1000, 375, 650, 500, 330];

function pickRefSize(sizes: SizePrice[]): SizePrice {
  const pool = sizes.some((s) => s.isCurrent) ? sizes.filter((s) => s.isCurrent) : sizes;
  for (const ml of PREFERRED_REF_ML) {
    const match = pool.filter((s) => s.ml === ml);
    if (match.length) return match.find((s) => /glass/i.test(s.packageType)) ?? match[0];
  }
  const underLitre = pool.filter((s) => s.ml <= 1000);
  if (underLitre.length) return underLitre[underLitre.length - 1];
  return pool[0];
}

/** Group cleaned rows into one product per state + excise type + product name. */
export function buildProducts(rows: PriceRow[]): ProductData[] {
  const latestFy = rows.reduce((max, r) => (r.fy > max ? r.fy : max), "");
  const groups = new Map<string, PriceRow[]>();
  for (const r of rows) {
    const key = `${r.state}/${r.typeSlug}/${r.brandSlug}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const brands: ProductData[] = [];
  for (const [key, brandRows] of groups) {
    const bySize = new Map<string, PriceRow[]>();
    for (const r of brandRows) {
      const sizeKey = `${r.ml}-ml-${slugify(r.packageType)}`;
      const list = bySize.get(sizeKey);
      if (list) list.push(r);
      else bySize.set(sizeKey, [r]);
    }

    const sizes: SizePrice[] = [...bySize.entries()].map(([sizeKey, sizeRows]) => {
      const sorted = [...sizeRows].sort(compareRows);
      const cur = sorted[sorted.length - 1];
      return {
        key: sizeKey,
        ml: cur.ml,
        label: cur.sizeLabel,
        packageType: cur.packageType,
        strength: cur.strength,
        fy: cur.fy,
        validFrom: cur.validFrom,
        validTo: cur.validTo,
        mrp: cur.mrp,
        wsp: cur.wsp,
        exciseDuty: cur.exciseDuty,
        exciseRounding: cur.exciseRounding,
        retailMargin: cur.retailMargin,
        salesPrice: cur.salesPrice,
        vat: cur.vat,
        isCurrent: cur.fy === latestFy,
        history: buildHistory(sorted),
      };
    });
    sizes.sort((a, b) => a.ml - b.ml || a.packageType.localeCompare(b.packageType));

    const priced = sizes.some((s) => s.isCurrent) ? sizes.filter((s) => s.isCurrent) : sizes;
    const ref = pickRefSize(sizes);
    const first = brandRows[0];

    brands.push({
      key,
      state: first.state,
      typeSlug: first.typeSlug,
      typeName: first.typeName,
      slug: first.brandSlug,
      // Prefer the most common spelling across rows as the display name.
      name: mostCommon(brandRows.map((r) => r.brandName)),
      rawNames: unique(brandRows.map((r) => r.brandRaw)).sort(),
      kind: mostCommon(brandRows.map((r) => r.kind)),
      category: mostCommon(brandRows.map((r) => r.category)),
      origins: unique(brandRows.map((r) => r.origin).filter((o): o is string => !!o)).sort(),
      suppliers: unique(brandRows.map((r) => r.supplier).filter(Boolean)).sort(),
      sizes,
      minMrp: Math.min(...priced.map((s) => s.mrp)),
      maxMrp: Math.max(...priced.map((s) => s.mrp)),
      refMrp: ref.mrp,
      refSize: ref.label,
      refKey: ref.key,
      latestFy: brandRows.reduce((max, r) => (r.fy > max ? r.fy : max), ""),
      isCurrent: sizes.some((s) => s.isCurrent),
      inSource: true,
    });
  }
  return brands;
}
