import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as { _mongoClientPromise?: Promise<MongoClient> };

function getUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
  return uri;
}

/** One shared client per process (survives hot reloads and warm serverless invocations). */
export function getClient(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(getUri(), {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
      appName: "liquor-price-index",
    });
    globalForMongo._mongoClientPromise = client.connect().catch((err) => {
      globalForMongo._mongoClientPromise = undefined;
      throw err;
    });
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || "liquor");
}

export const COLLECTIONS = {
  brands: "brands",
  priceChanges: "price_changes",
  syncRuns: "sync_runs",
  imports: "imports",
} as const;

let indexesReady: Promise<void> | null = null;

export function ensureIndexes(db: Db): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const brands = db.collection(COLLECTIONS.brands);
      await brands.createIndexes([
        { key: { key: 1 }, unique: true, name: "key_unique" },
        { key: { state: 1, typeSlug: 1, refMrp: 1 }, name: "state_type_price" },
        { key: { state: 1, slug: 1 }, name: "state_slug" },
        { key: { name: "text", rawNames: "text" }, name: "brand_text" },
      ]);
      await db.collection(COLLECTIONS.priceChanges).createIndex({ state: 1, detectedAt: -1 });
      await db.collection(COLLECTIONS.priceChanges).createIndex({ brandKey: 1, detectedAt: -1 });
      await db.collection(COLLECTIONS.syncRuns).createIndex({ state: 1, startedAt: -1 });
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}
