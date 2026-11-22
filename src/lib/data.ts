import { cacheLife, cacheTag } from "next/cache";
import { variantLabel } from "./brand-match";
import { CATEGORIES } from "./categories";
import { PRICES_TAG } from "./config";
import { COLLECTIONS, getDb } from "./mongodb";
import type { BrandDoc, BrandPriceChange, BrandSummary, CategorySummary, PriceChange, ProductDoc, StatePrice } from "./types";

/**
 * Every read here is cached and tagged. Pages built from them are static;
 * the daily sync and admin changes call revalidateTag(PRICES_TAG) to refresh them.
 */
function cached() {
  cacheLife("days");
  cacheTag(PRICES_TAG);
}

/** Only brands switched on in the admin appear anywhere on the site. */
const ENABLED = { enabled: true } as const;

const BRAND_PROJECTION = {
  _id: 0,
  key: 1,
  category: 1,
  slug: 1,
  name: 1,
  priceText: 1,
  priceMin: 1,
  priceMax: 1,
  priceNote: 1,
  image: 1,
  updatedAt: 1,
} as const;

type BrandRow = Pick<BrandDoc, "key" | "category" | "slug" | "name" | "priceText" | "priceMin" | "priceMax" | "priceNote" | "image" | "updatedAt">;

/** Add official-price and state-coverage stats to a list of brands. */
async function summarize(rows: BrandRow[]): Promise<BrandSummary[]> {
  if (!rows.length) return [];
  const db = await getDb();
  const keys = rows.map((r) => r.key);
  const [productStats, stateStats] = await Promise.all([
    db
      .collection<ProductDoc>(COLLECTIONS.products)
      .aggregate<{ _id: string; min: number; max: number; count: number; states: string[] }>([
        { $match: { brandKey: { $in: keys }, isCurrent: true } },
        { $group: { _id: "$brandKey", min: { $min: "$minMrp" }, max: { $max: "$maxMrp" }, count: { $sum: 1 }, states: { $addToSet: "$state" } } },
      ])
      .toArray(),
    db
      .collection<StatePrice>(COLLECTIONS.statePrices)
      .aggregate<{ _id: string; states: string[] }>([{ $match: { brandKey: { $in: keys } } }, { $group: { _id: "$brandKey", states: { $addToSet: "$state" } } }])
      .toArray(),
  ]);
  const ps = new Map(productStats.map((p) => [p._id, p]));
  const ss = new Map(stateStats.map((s) => [s._id, s.states]));
  return rows.map((r) => {
    const p = ps.get(r.key);
    const states = new Set([...(p?.states ?? []), ...(ss.get(r.key) ?? [])]);
    return {
      key: r.key,
      category: r.category,
      slug: r.slug,
      name: r.name,
      priceText: r.priceText ?? "",
      priceMin: r.priceMin ?? null,
      priceMax: r.priceMax ?? null,
      priceNote: r.priceNote ?? "",
      image: r.image ?? null,
      officialMin: p?.min ?? null,
      officialMax: p?.max ?? null,
      productCount: p?.count ?? 0,
      stateCount: states.size,
    };
  });
}

export async function getCategorySummaries(): Promise<CategorySummary[]> {
  "use cache";
  cached();
  const db = await getDb();
  const counts = await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .aggregate<{ _id: string; n: number }>([{ $match: ENABLED }, { $group: { _id: "$category", n: { $sum: 1 } } }])
    .toArray();
  const map = new Map(counts.map((c) => [c._id, c.n]));
  return CATEGORIES.map((c) => ({ slug: c.slug, name: c.name, emoji: c.emoji, brandCount: map.get(c.slug) ?? 0 }));
}

export async function getBrandsByCategory(category: string): Promise<BrandSummary[]> {
  "use cache";
  cached();
  const db = await getDb();
  const rows = await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .find({ category, ...ENABLED }, { projection: BRAND_PROJECTION })
    .collation({ locale: "en" })
    .sort({ name: 1 })
    .toArray();
  return summarize(rows as unknown as BrandRow[]);
}

/** Enabled brand params for prerendering every brand page at build time. */
export async function getAllBrandParams(): Promise<{ category: string; brand: string }[]> {
  "use cache";
  cached();
  const db = await getDb();
  const rows = await db.collection<BrandDoc>(COLLECTIONS.brands).find(ENABLED, { projection: { _id: 0, category: 1, slug: 1 } }).toArray();
  return rows.map((r) => ({ category: r.category, brand: r.slug }));
}

export type DisplayProduct = {
  key: string;
  state: string;
  name: string;
  variant: string;
  typeName: string;
  isCurrent: boolean;
  latestFy: string;
  strength: number | null;
  sizes: ProductDoc["sizes"];
};

export type BrandPage = {
  brand: BrandDoc;
  products: DisplayProduct[];
  statePrices: StatePrice[];
};

/** Everything a brand page shows. Returns null for unknown or disabled brands. */
export async function getBrandPage(category: string, slug: string): Promise<BrandPage | null> {
  "use cache";
  cached();
  const db = await getDb();
  const brand = (await db.collection<BrandDoc>(COLLECTIONS.brands).findOne({ key: `${category}/${slug}` }, { projection: { _id: 0 } })) as BrandDoc | null;
  if (!brand || !brand.enabled) return null;
  const [products, statePrices] = await Promise.all([
    db
      .collection<ProductDoc>(COLLECTIONS.products)
      // Only products on the current excise list; older listings are never shown.
      .find({ brandKey: brand.key, isCurrent: true }, { projection: { _id: 0, key: 1, state: 1, name: 1, label: 1, typeName: 1, isCurrent: 1, latestFy: 1, sizes: 1 } })
      .sort({ name: 1 })
      .toArray(),
    db.collection<StatePrice>(COLLECTIONS.statePrices).find({ brandKey: brand.key }, { projection: { _id: 0 } }).sort({ state: 1, variant: 1, ml: 1 }).toArray(),
  ]);
  return {
    brand,
    products: (products as unknown as ProductDoc[]).map((p) => ({
      key: p.key,
      state: p.state,
      name: p.name,
      variant: p.label?.trim() || variantLabel(p.name, brand.name),
      typeName: p.typeName,
      isCurrent: p.isCurrent,
      latestFy: p.latestFy,
      strength: p.sizes.find((s) => s.strength)?.strength ?? null,
      sizes: p.sizes.map((s) => ({ ...s, history: s.history })),
    })),
    statePrices: statePrices as StatePrice[],
  };
}

/** Same category, closest approximate price. */
export async function getRelatedBrands(category: string, slug: string, price: number | null, limit = 8): Promise<BrandSummary[]> {
  "use cache";
  cached();
  const db = await getDb();
  const rows = (await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .find({ category, slug: { $ne: slug }, ...ENABLED }, { projection: BRAND_PROJECTION })
    .toArray()) as unknown as BrandRow[];
  const target = price ?? 0;
  const sorted = rows.sort((a, b) => Math.abs((a.priceMin ?? 1e9) - target) - Math.abs((b.priceMin ?? 1e9) - target)).slice(0, limit);
  return summarize(sorted);
}

/** Brands with the most official products first: usually the best-known ones. */
export async function getPopularBrands(limit = 12, category?: string): Promise<BrandSummary[]> {
  "use cache";
  cached();
  const db = await getDb();
  const counts = await db
    .collection<ProductDoc>(COLLECTIONS.products)
    .aggregate<{ _id: string; n: number }>([
      { $match: { brandKey: { $ne: null }, isCurrent: true, ...(category ? { brandKey: { $regex: `^${category}/` } } : {}) } },
      { $group: { _id: "$brandKey", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: limit * 3 },
    ])
    .toArray();
  const rows = (await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .find({ key: { $in: counts.map((c) => c._id) }, ...ENABLED }, { projection: BRAND_PROJECTION })
    .toArray()) as unknown as BrandRow[];
  const order = new Map(counts.map((c, i) => [c._id, i]));
  let picked = rows.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0)).slice(0, limit);
  if (picked.length < limit) {
    // Top up with priced brands from your list.
    const more = (await db
      .collection<BrandDoc>(COLLECTIONS.brands)
      .find({ ...ENABLED, ...(category ? { category } : {}), key: { $nin: picked.map((p) => p.key) }, priceMin: { $ne: null } }, { projection: BRAND_PROJECTION })
      .collation({ locale: "en" })
      .sort({ name: 1 })
      .limit(limit - picked.length)
      .toArray()) as unknown as BrandRow[];
    picked = [...picked, ...more];
  }
  return summarize(picked);
}

async function resolveChanges(changes: PriceChange[], limit: number): Promise<BrandPriceChange[]> {
  if (!changes.length) return [];
  const db = await getDb();
  const products = (await db
    .collection<ProductDoc>(COLLECTIONS.products)
    .find({ key: { $in: changes.map((c) => c.productKey) }, brandKey: { $ne: null } }, { projection: { _id: 0, key: 1, brandKey: 1, name: 1, label: 1 } })
    .toArray()) as unknown as ProductDoc[];
  const brands = (await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .find({ key: { $in: products.map((p) => p.brandKey!) }, ...ENABLED }, { projection: { _id: 0, key: 1, name: 1 } })
    .toArray()) as unknown as BrandDoc[];
  const productMap = new Map(products.map((p) => [p.key, p]));
  const brandMap = new Map(brands.map((b) => [b.key, b]));
  const out: BrandPriceChange[] = [];
  for (const c of changes) {
    const p = productMap.get(c.productKey);
    const b = p?.brandKey ? brandMap.get(p.brandKey) : undefined;
    if (!p || !b) continue;
    out.push({ ...c, brandKey: b.key, brandName: b.name, variant: p.label?.trim() || variantLabel(p.name, b.name) });
    if (out.length >= limit) break;
  }
  return out;
}

export async function getRecentChanges(limit = 10): Promise<BrandPriceChange[]> {
  "use cache";
  cached();
  const db = await getDb();
  const changes = (await db.collection<PriceChange>(COLLECTIONS.priceChanges).find({}, { projection: { _id: 0 } }).sort({ detectedAt: -1 }).limit(limit * 5).toArray()) as PriceChange[];
  return resolveChanges(changes, limit);
}

export async function getBrandChanges(brandKey: string, limit = 20): Promise<BrandPriceChange[]> {
  "use cache";
  cached();
  const db = await getDb();
  const keys = (await db.collection<ProductDoc>(COLLECTIONS.products).find({ brandKey }, { projection: { _id: 0, key: 1 } }).toArray()).map((p) => p.key);
  if (!keys.length) return [];
  const changes = (await db
    .collection<PriceChange>(COLLECTIONS.priceChanges)
    .find({ productKey: { $in: keys } }, { projection: { _id: 0 } })
    .sort({ detectedAt: -1 })
    .limit(limit)
    .toArray()) as PriceChange[];
  return resolveChanges(changes, limit);
}

export type SiteStats = { brandCount: number; latestFy: string; lastSyncedAt: string | null };

export async function getSiteStats(): Promise<SiteStats> {
  "use cache";
  cached();
  const db = await getDb();
  const [brandCount, fy, run] = await Promise.all([
    db.collection<BrandDoc>(COLLECTIONS.brands).countDocuments(ENABLED),
    db.collection<ProductDoc>(COLLECTIONS.products).find({}, { projection: { _id: 0, latestFy: 1 } }).sort({ latestFy: -1 }).limit(1).toArray(),
    db.collection(COLLECTIONS.syncRuns).findOne({ status: { $in: ["updated", "unchanged"] } }, { sort: { startedAt: -1 }, projection: { finishedAt: 1 } }),
  ]);
  return { brandCount, latestFy: fy[0]?.latestFy ?? "", lastSyncedAt: (run?.finishedAt as string | undefined) ?? null };
}

export type SitemapEntry = { category: string; slug: string; updatedAt: string };

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  "use cache";
  cached();
  const db = await getDb();
  const rows = await db.collection<BrandDoc>(COLLECTIONS.brands).find(ENABLED, { projection: { _id: 0, category: 1, slug: 1, updatedAt: 1 } }).toArray();
  return rows as unknown as SitemapEntry[];
}
