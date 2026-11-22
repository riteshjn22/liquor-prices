import type { AnyBulkWriteOperation, Db } from "mongodb";
import { CATEGORIES, categoryForExciseType } from "./categories";
import { COLLECTIONS } from "./mongodb";
import { slugify } from "./normalize";
import type { BrandDoc, ProductDoc } from "./types";

/** Parse "₹700 – ₹1,800 (Varietal)" -> { min: 700, max: 1800, note: "Varietal" } */
export function parsePriceRange(text: string): { min: number | null; max: number | null; note: string } {
  const t = (text ?? "").trim();
  const note = (t.match(/\(([^)]*)\)/)?.[1] ?? "").trim();
  const withoutNote = t.replace(/\([^)]*\)/g, "");
  const nums = [...withoutNote.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, ""))).filter((n) => n > 0);
  if (!nums.length) return { min: null, max: null, note: note || (t && !/\d/.test(t) ? t : "") };
  return { min: Math.min(...nums), max: Math.max(...nums), note };
}

export function formatRange(min: number | null, max: number | null): string {
  const f = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  if (min === null) return "";
  return max !== null && max !== min ? `${f(min)} – ${f(max)}` : f(min);
}

/** Slug patterns that identify a brand's products: its name plus any extra match words. */
export function brandPatterns(b: Pick<BrandDoc, "name" | "slug" | "matchWords">): string[] {
  return [...new Set([b.slug, slugify(b.name), ...(b.matchWords ?? []).map(slugify)].filter(Boolean))];
}

/**
 * Find the brand a product belongs to: same category, and the product slug starts
 * with one of the brand's patterns. The longest match wins, so "Old Monk Coffee"
 * products go to that brand rather than to "Old Monk".
 */
export function matchBrand(product: Pick<ProductDoc, "slug" | "typeSlug">, brands: Pick<BrandDoc, "key" | "category" | "name" | "slug" | "matchWords">[]): string | null {
  const cat = categoryForExciseType(product.typeSlug);
  if (!cat) return null;
  let best: { key: string; len: number } | null = null;
  for (const b of brands) {
    if (b.category !== cat.slug) continue;
    for (const p of brandPatterns(b)) {
      if ((product.slug === p || product.slug.startsWith(`${p}-`)) && (!best || p.length > best.len)) best = { key: b.key, len: p.length };
    }
  }
  return best?.key ?? null;
}

/** "Old Monk Matured XXX Select Rum VOV" under brand "Old Monk" -> "Matured XXX Select Rum VOV" */
export function variantLabel(productName: string, brandName: string): string {
  const words = productName.split(/\s+/);
  const brandTokens = slugify(brandName).split("-").filter(Boolean);
  let i = 0;
  let consumed = 0;
  // Walk product words while their slug tokens match the brand's tokens in order.
  while (i < words.length && consumed < brandTokens.length) {
    const tokens = slugify(words[i]).split("-").filter(Boolean);
    if (!tokens.length) {
      i++;
      continue;
    }
    if (tokens.every((t, j) => brandTokens[consumed + j] === t)) {
      consumed += tokens.length;
      i++;
    } else break;
  }
  const rest = consumed === brandTokens.length ? words.slice(i).join(" ").trim() : "";
  const label = rest || productName;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Recompute which brand every product belongs to. Call after a sync, after brands
 * are added/renamed, or after product assignments change. Only changed docs are written.
 */
export async function assignBrands(db: Db): Promise<{ matched: number; changed: number }> {
  const brands = (await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .find({}, { projection: { _id: 0, key: 1, category: 1, name: 1, slug: 1, matchWords: 1 } })
    .toArray()) as unknown as BrandDoc[];
  const brandKeys = new Set(brands.map((b) => b.key));
  const products = (await db
    .collection<ProductDoc>(COLLECTIONS.products)
    .find({ typeSlug: { $in: CATEGORIES.flatMap((c) => c.exciseTypes) } }, { projection: { _id: 0, key: 1, slug: 1, typeSlug: 1, brandKey: 1, autoBrandKey: 1, brandOverride: 1 } })
    .toArray()) as unknown as ProductDoc[];

  const ops: AnyBulkWriteOperation<ProductDoc>[] = [];
  let matched = 0;
  for (const p of products) {
    const auto = matchBrand(p, brands);
    const override = p.brandOverride;
    const effective = override === "none" ? null : override && brandKeys.has(override) ? override : auto;
    if (effective) matched++;
    if (auto !== (p.autoBrandKey ?? null) || effective !== (p.brandKey ?? null)) {
      ops.push({ updateOne: { filter: { key: p.key }, update: { $set: { autoBrandKey: auto, brandKey: effective } } } });
    }
  }
  if (ops.length) await db.collection<ProductDoc>(COLLECTIONS.products).bulkWrite(ops, { ordered: false });
  return { matched, changed: ops.length };
}
