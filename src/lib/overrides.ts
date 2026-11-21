import type { BrandDoc, BrandOverrides, SizePrice } from "./types";

/** Fields that depend on overrides and are recomputed whenever official data or overrides change. */
export type EffectiveFields = Pick<BrandDoc, "name" | "officialName" | "sizes" | "minMrp" | "maxMrp" | "refMrp" | "hidden">;

type OfficialInput = Pick<BrandDoc, "name" | "sizes" | "refSize"> & Partial<Pick<BrandDoc, "officialName" | "refKey" | "refMrp">>;

/**
 * Combine the official excise data with manual overrides.
 * Used by the sync (after fetching new official data) and by the Excel import.
 * The brand slug/URL is never touched, so renaming a brand never breaks links.
 */
export function applyOverrides(doc: OfficialInput, ov: BrandOverrides | undefined): EffectiveFields {
  const officialName = doc.officialName ?? doc.name;
  const prices = ov?.prices ?? {};

  const sizes: SizePrice[] = doc.sizes.map((s) => {
    const officialMrp = s.officialMrp ?? s.mrp;
    const override = prices[s.key];
    const hasOverride = typeof override === "number" && override > 0 && override !== officialMrp;
    return { ...s, officialMrp, mrp: hasOverride ? override : officialMrp, overridden: hasOverride };
  });

  const pool = sizes.some((s) => s.isCurrent) ? sizes.filter((s) => s.isCurrent) : sizes;
  const ref =
    (doc.refKey && sizes.find((s) => s.key === doc.refKey)) ||
    // Older documents (before refKey existed): match by label and official price.
    sizes.find((s) => s.label === doc.refSize && (doc.refMrp === undefined || s.officialMrp === doc.refMrp)) ||
    sizes.find((s) => s.label === doc.refSize) ||
    pool[0];

  return {
    name: ov?.name?.trim() || officialName,
    officialName,
    sizes,
    minMrp: Math.min(...pool.map((s) => s.mrp)),
    maxMrp: Math.max(...pool.map((s) => s.mrp)),
    refMrp: ref.mrp,
    hidden: ov?.hidden === true,
  };
}

/** Drop empty values so "no override" is stored as a missing field, not an empty string. */
export function cleanOverrides(ov: BrandOverrides): BrandOverrides | undefined {
  const out: BrandOverrides = {};
  if (ov.name?.trim()) out.name = ov.name.trim();
  if (ov.description?.trim()) out.description = ov.description.trim();
  if (ov.seoTitle?.trim()) out.seoTitle = ov.seoTitle.trim();
  if (ov.seoDescription?.trim()) out.seoDescription = ov.seoDescription.trim();
  if (ov.hidden) out.hidden = true;
  const prices = Object.entries(ov.prices ?? {}).filter(([, v]) => typeof v === "number" && v > 0);
  if (prices.length) out.prices = Object.fromEntries(prices);
  return Object.keys(out).length ? out : undefined;
}
