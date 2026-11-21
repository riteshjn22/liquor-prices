import { cacheLife, cacheTag } from "next/cache";
import { COLLECTIONS, getDb } from "./mongodb";
import { PRICES_TAG, STATES } from "./config";
import type { BrandDoc, BrandSummary, PriceChange, TypeSummary } from "./types";

/**
 * Every read here is cached and tagged. Pages built from them are static;
 * the daily sync calls revalidateTag(PRICES_TAG) to refresh them.
 */
function cached() {
  cacheLife("days");
  cacheTag(PRICES_TAG);
}

/** Brands hidden through the Excel upload are left out of every list, search and the sitemap. */
const VISIBLE = { hidden: { $ne: true } } as const;

const SUMMARY_PROJECTION = {
  _id: 0,
  key: 1,
  state: 1,
  typeSlug: 1,
  typeName: 1,
  slug: 1,
  name: 1,
  kind: 1,
  minMrp: 1,
  maxMrp: 1,
  refMrp: 1,
  refSize: 1,
  latestFy: 1,
  isCurrent: 1,
  image: 1,
  "sizes.label": 1,
} as const;

type SummaryDoc = Omit<BrandSummary, "sizeLabels"> & { sizes: { label: string }[] };

function toSummary(doc: SummaryDoc): BrandSummary {
  const { sizes, ...rest } = doc;
  return { ...rest, image: rest.image ?? null, sizeLabels: [...new Set(sizes.map((s) => s.label))] };
}

export async function getTypes(state: string): Promise<TypeSummary[]> {
  "use cache";
  cached();
  const db = await getDb();
  const rows = await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .aggregate<TypeSummary>([
      { $match: { state, ...VISIBLE } },
      {
        $group: {
          _id: "$typeSlug",
          name: { $first: "$typeName" },
          brandCount: { $sum: 1 },
          minMrp: { $min: "$minMrp" },
          maxMrp: { $max: "$maxMrp" },
          minRef: { $min: "$refMrp" },
          maxRef: { $max: "$refMrp" },
        },
      },
      {
        $project: { _id: 0, state: { $literal: state }, slug: "$_id", name: 1, brandCount: 1, minMrp: 1, maxMrp: 1, minRef: 1, maxRef: 1 },
      },
      { $sort: { brandCount: -1 } },
    ])
    .toArray();
  return rows;
}

export async function getType(state: string, typeSlug: string): Promise<TypeSummary | null> {
  "use cache";
  cached();
  const types = await getTypes(state);
  return types.find((t) => t.slug === typeSlug) ?? null;
}

export async function getBrandsByType(state: string, typeSlug: string): Promise<BrandSummary[]> {
  "use cache";
  cached();
  const db = await getDb();
  const docs = await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .find({ state, typeSlug, ...VISIBLE }, { projection: SUMMARY_PROJECTION })
    .sort({ isCurrent: -1, name: 1 })
    .toArray();
  return (docs as unknown as SummaryDoc[]).map(toSummary);
}

export async function getBrand(state: string, typeSlug: string, slug: string): Promise<BrandDoc | null> {
  "use cache";
  cached();
  const db = await getDb();
  const doc = await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .findOne({ key: `${state}/${typeSlug}/${slug}` }, { projection: { _id: 0 } });
  return (doc as BrandDoc | null) ?? null;
}

/** Same type, closest in price: good internal links for SEO and users. */
export async function getRelatedBrands(state: string, typeSlug: string, slug: string, refMrp: number, limit = 8): Promise<BrandSummary[]> {
  "use cache";
  cached();
  const db = await getDb();
  const col = db.collection<BrandDoc>(COLLECTIONS.brands);
  const base = { state, typeSlug, slug: { $ne: slug }, isCurrent: true, ...VISIBLE };
  const [cheaper, pricier] = await Promise.all([
    col.find({ ...base, refMrp: { $lte: refMrp } }, { projection: SUMMARY_PROJECTION }).sort({ refMrp: -1 }).limit(limit / 2).toArray(),
    col.find({ ...base, refMrp: { $gt: refMrp } }, { projection: SUMMARY_PROJECTION }).sort({ refMrp: 1 }).limit(limit / 2).toArray(),
  ]);
  return ([...cheaper.reverse(), ...pricier] as unknown as SummaryDoc[]).map(toSummary);
}

export async function getCheapest(state: string, typeSlug: string, limit = 10): Promise<BrandSummary[]> {
  "use cache";
  cached();
  const db = await getDb();
  const docs = await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .find({ state, typeSlug, isCurrent: true, refSize: "750 ml", ...VISIBLE }, { projection: SUMMARY_PROJECTION })
    .sort({ refMrp: 1 })
    .limit(limit)
    .toArray();
  return (docs as unknown as SummaryDoc[]).map(toSummary);
}

export async function getRecentChanges(state: string, limit = 12): Promise<PriceChange[]> {
  "use cache";
  cached();
  const db = await getDb();
  const docs = await db
    .collection<PriceChange>(COLLECTIONS.priceChanges)
    .find({ state }, { projection: { _id: 0 } })
    .sort({ detectedAt: -1 })
    .limit(limit * 2)
    .toArray();
  // Skip brands that were hidden through the Excel upload.
  const hidden = new Set(
    (
      await db
        .collection<BrandDoc>(COLLECTIONS.brands)
        .find({ key: { $in: docs.map((d) => d.brandKey) }, hidden: true }, { projection: { _id: 0, key: 1 } })
        .toArray()
    ).map((b) => b.key),
  );
  return (docs as PriceChange[]).filter((d) => !hidden.has(d.brandKey)).slice(0, limit);
}

export async function getBrandChanges(brandKey: string): Promise<PriceChange[]> {
  "use cache";
  cached();
  const db = await getDb();
  const docs = await db
    .collection<PriceChange>(COLLECTIONS.priceChanges)
    .find({ brandKey }, { projection: { _id: 0 } })
    .sort({ detectedAt: -1 })
    .limit(20)
    .toArray();
  return docs as PriceChange[];
}

export type StateStats = { latestFy: string; brandCount: number; lastSyncedAt: string | null };

export async function getStateStats(state: string): Promise<StateStats> {
  "use cache";
  cached();
  const db = await getDb();
  const [agg, run] = await Promise.all([
    db
      .collection<BrandDoc>(COLLECTIONS.brands)
      .aggregate<{ latestFy: string; brandCount: number }>([
        { $match: { state, ...VISIBLE } },
        { $group: { _id: null, latestFy: { $max: "$latestFy" }, brandCount: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection(COLLECTIONS.syncRuns)
      .findOne({ state, status: { $in: ["updated", "unchanged"] } }, { sort: { startedAt: -1 }, projection: { finishedAt: 1 } }),
  ]);
  return {
    latestFy: agg[0]?.latestFy ?? "",
    brandCount: agg[0]?.brandCount ?? 0,
    lastSyncedAt: (run?.finishedAt as string | undefined) ?? null,
  };
}

/** Brands with the most sizes tend to be the mass-market ones people search for. */
export async function getPopularBrands(state: string, limit = 12, typeSlug?: string): Promise<BrandSummary[]> {
  "use cache";
  cached();
  const db = await getDb();
  const docs = await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .aggregate([
      { $match: { state, isCurrent: true, ...VISIBLE, ...(typeSlug ? { typeSlug } : {}) } },
      { $addFields: { sizeCount: { $size: "$sizes" } } },
      { $sort: { sizeCount: -1, refMrp: 1 } },
      { $limit: limit },
      { $project: SUMMARY_PROJECTION },
    ])
    .toArray();
  return (docs as unknown as SummaryDoc[]).map(toSummary);
}

export type SitemapEntry = { state: string; typeSlug: string; slug: string; updatedAt: string };

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  "use cache";
  cached();
  const db = await getDb();
  const docs = await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .find({ state: { $in: STATES.map((s) => s.slug) }, ...VISIBLE }, { projection: { _id: 0, state: 1, typeSlug: 1, slug: 1, updatedAt: 1 } })
    .toArray();
  return docs as unknown as SitemapEntry[];
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchBrands(query: string, limit = 60): Promise<BrandSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(PRICES_TAG);
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 0).slice(0, 6);
  if (!words.length) return [];
  const db = await getDb();
  const docs = await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .find(
      { ...VISIBLE, $and: words.map((w) => ({ $or: [{ name: { $regex: escapeRegex(w), $options: "i" } }, { typeName: { $regex: escapeRegex(w), $options: "i" } }] })) },
      { projection: SUMMARY_PROJECTION },
    )
    .sort({ isCurrent: -1, refMrp: 1 })
    .limit(limit)
    .toArray();
  return (docs as unknown as SummaryDoc[]).map(toSummary);
}
