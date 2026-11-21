import type { AnyBulkWriteOperation } from "mongodb";
import { buildBrands } from "./build-brands";
import { COLLECTIONS, ensureIndexes, getDb } from "./mongodb";
import { SOURCES, type FetchOptions } from "./sources";
import { applyOverrides } from "./overrides";
import type { BrandDoc, BrandOverrides, PriceChange, SyncResult } from "./types";

type ExistingBrand = Pick<BrandDoc, "key"> & {
  overrides?: BrandOverrides;
  sizes?: { key: string; mrp: number; officialMrp?: number }[];
};

/**
 * Pull the latest list for one state, clean it, and upsert it into MongoDB.
 * Safe to run repeatedly. Brands that disappear from the source keep their
 * page (inSource: false) so indexed URLs never 404.
 */
export async function runSync(
  state: string,
  opts: { force?: boolean; fetch?: FetchOptions } = {},
): Promise<SyncResult> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const db = await getDb();
  await ensureIndexes(db);
  const runs = db.collection(COLLECTIONS.syncRuns);
  const fetcher = SOURCES[state];

  const base: SyncResult = { state, status: "failed", rows: 0, brands: 0, inserted: 0, updated: 0, priceChanges: 0, ms: 0 };

  try {
    if (!fetcher) throw new Error(`No source configured for state "${state}"`);
    const { rows, hash } = await fetcher(opts.fetch);

    const lastOk = await runs.findOne(
      { state, status: { $in: ["updated", "unchanged"] } },
      { sort: { startedAt: -1 }, projection: { hash: 1 } },
    );
    if (!opts.force && lastOk?.hash === hash) {
      const result: SyncResult = { ...base, status: "unchanged", rows: rows.length, ms: Date.now() - started };
      await runs.insertOne({ ...result, hash, startedAt, finishedAt: new Date().toISOString() });
      return result;
    }

    const brands = buildBrands(rows);
    const brandsCol = db.collection<BrandDoc>(COLLECTIONS.brands);
    const existing = await brandsCol
      .find(
        { state },
        { projection: { _id: 0, key: 1, overrides: 1, "sizes.key": 1, "sizes.mrp": 1, "sizes.officialMrp": 1 } },
      )
      .toArray() as unknown as ExistingBrand[];
    const existingMap = new Map(existing.map((b) => [b.key, b]));

    const now = new Date().toISOString();
    const changes: PriceChange[] = [];
    const ops: AnyBulkWriteOperation<BrandDoc>[] = brands.map((b) => {
      const old = existingMap.get(b.key);
      // Re-apply manual Excel edits on top of the fresh official data.
      const effective = applyOverrides(b, old?.overrides);
      let changed = false;
      if (old?.sizes) {
        // Compare official prices only, so a manual override never shows up as a "price change".
        const oldPrices = new Map(old.sizes.map((s) => [s.key, s.officialMrp ?? s.mrp]));
        for (const s of b.sizes) {
          const prev = oldPrices.get(s.key);
          if (prev !== undefined && prev !== s.mrp) {
            changed = true;
            changes.push({
              state,
              brandKey: b.key,
              brandName: effective.name,
              typeSlug: b.typeSlug,
              brandSlug: b.slug,
              sizeKey: s.key,
              sizeLabel: `${s.label} ${s.packageType}`,
              oldMrp: prev,
              newMrp: s.mrp,
              detectedAt: now,
            });
          }
        }
      }
      return {
        updateOne: {
          filter: { key: b.key },
          update: {
            // `overrides` and `image` are never in this $set, so manual edits survive every sync.
            $set: { ...b, ...effective, updatedAt: now, ...(changed ? { priceChangedAt: now } : {}) },
            $setOnInsert: { createdAt: now, image: null },
          },
          upsert: true,
        },
      };
    });

    const write = await brandsCol.bulkWrite(ops, { ordered: false });
    const seen = brands.map((b) => b.key);
    await brandsCol.updateMany({ state, key: { $nin: seen }, inSource: true }, { $set: { inSource: false, updatedAt: now } });
    if (changes.length) await db.collection(COLLECTIONS.priceChanges).insertMany(changes);

    const result: SyncResult = {
      ...base,
      status: "updated",
      rows: rows.length,
      brands: brands.length,
      inserted: write.upsertedCount,
      updated: write.modifiedCount,
      priceChanges: changes.length,
      ms: Date.now() - started,
    };
    await runs.insertOne({ ...result, hash, startedAt, finishedAt: new Date().toISOString() });
    return result;
  } catch (err) {
    const result: SyncResult = { ...base, error: err instanceof Error ? err.message : String(err), ms: Date.now() - started };
    await runs.insertOne({ ...result, startedAt, finishedAt: new Date().toISOString() }).catch(() => {});
    return result;
  }
}
