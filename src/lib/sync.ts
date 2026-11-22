import type { AnyBulkWriteOperation } from "mongodb";
import { assignBrands } from "./brand-match";
import { buildProducts } from "./build-products";
import { COLLECTIONS, ensureIndexes, getDb } from "./mongodb";
import { SOURCES, type FetchOptions } from "./sources";
import type { PriceChange, ProductDoc, SyncResult } from "./types";

type ExistingProduct = Pick<ProductDoc, "key"> & { sizes?: { key: string; mrp: number }[] };

/**
 * Pull the latest excise list for one state, clean it, and upsert the products.
 * Then re-match products to your brands. Safe to run repeatedly.
 * Products that disappear from the source are kept (inSource: false).
 */
export async function runSync(state: string, opts: { force?: boolean; fetch?: FetchOptions } = {}): Promise<SyncResult> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const db = await getDb();
  await ensureIndexes(db);
  const runs = db.collection(COLLECTIONS.syncRuns);
  const fetcher = SOURCES[state];

  const base: SyncResult = { state, status: "failed", rows: 0, products: 0, inserted: 0, updated: 0, priceChanges: 0, ms: 0 };

  try {
    if (!fetcher) throw new Error(`No source configured for state "${state}"`);
    const { rows, hash } = await fetcher(opts.fetch);

    const lastOk = await runs.findOne({ state, status: { $in: ["updated", "unchanged"] } }, { sort: { startedAt: -1 }, projection: { hash: 1 } });
    if (!opts.force && lastOk?.hash === hash) {
      const result: SyncResult = { ...base, status: "unchanged", rows: rows.length, ms: Date.now() - started };
      await runs.insertOne({ ...result, hash, startedAt, finishedAt: new Date().toISOString() });
      return result;
    }

    const products = buildProducts(rows);
    const col = db.collection<ProductDoc>(COLLECTIONS.products);
    const existing = (await col
      .find({ state }, { projection: { _id: 0, key: 1, "sizes.key": 1, "sizes.mrp": 1 } })
      .toArray()) as unknown as ExistingProduct[];
    const existingMap = new Map(existing.map((p) => [p.key, p]));

    const now = new Date().toISOString();
    const changes: PriceChange[] = [];
    const ops: AnyBulkWriteOperation<ProductDoc>[] = products.map((p) => {
      const old = existingMap.get(p.key);
      let changed = false;
      if (old?.sizes) {
        const oldPrices = new Map(old.sizes.map((s) => [s.key, s.mrp]));
        for (const s of p.sizes) {
          const prev = oldPrices.get(s.key);
          if (prev !== undefined && prev !== s.mrp) {
            changed = true;
            changes.push({
              state,
              productKey: p.key,
              productName: p.name,
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
          filter: { key: p.key },
          // Brand assignment fields (brandKey, brandOverride, label) are never in this $set,
          // so admin edits survive every sync.
          update: { $set: { ...p, updatedAt: now, ...(changed ? { priceChangedAt: now } : {}) }, $setOnInsert: { createdAt: now } },
          upsert: true,
        },
      };
    });

    const write = await col.bulkWrite(ops, { ordered: false });
    const seen = products.map((p) => p.key);
    await col.updateMany({ state, key: { $nin: seen }, inSource: true }, { $set: { inSource: false, updatedAt: now } });
    if (changes.length) await db.collection(COLLECTIONS.priceChanges).insertMany(changes);
    const { matched } = await assignBrands(db);

    const result: SyncResult = {
      ...base,
      status: "updated",
      rows: rows.length,
      products: products.length,
      inserted: write.upsertedCount,
      updated: write.modifiedCount,
      priceChanges: changes.length,
      matched,
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
