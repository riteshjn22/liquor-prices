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
  /** Your brand list: one document (and page) per brand family. */
  brands: "brands",
  /** Products from state excise lists (Delhi), matched to brands. */
  products: "products",
  /** Prices added by hand for other states. */
  statePrices: "state_prices",
  priceChanges: "price_changes",
  syncRuns: "sync_runs",
  imports: "imports",
  /** Editable page sections (About blocks, law page). */
  pageContent: "page_content",
  /** Admin-managed FAQs, one document per page. */
  faqs: "faqs",
  posts: "posts",
  blogCategories: "blog_categories",
  /** Small site settings, one document per key (e.g. "home:cards"). */
  settings: "settings",
} as const;

let indexesReady: Promise<void> | null = null;

export function ensureIndexes(db: Db): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      await db.collection(COLLECTIONS.brands).createIndexes([
        { key: { key: 1 }, unique: true, name: "key_unique" },
        { key: { category: 1, enabled: 1, name: 1 }, name: "category_enabled_name" },
      ]);
      await db.collection(COLLECTIONS.products).createIndexes([
        { key: { key: 1 }, unique: true, name: "key_unique" },
        { key: { brandKey: 1 }, name: "brand" },
        { key: { state: 1, typeSlug: 1 }, name: "state_type" },
      ]);
      await db.collection(COLLECTIONS.statePrices).createIndexes([
        { key: { id: 1 }, unique: true, name: "id_unique" },
        { key: { brandKey: 1, state: 1 }, name: "brand_state" },
      ]);
      await db.collection(COLLECTIONS.priceChanges).createIndex({ detectedAt: -1 });
      await db.collection(COLLECTIONS.priceChanges).createIndex({ productKey: 1, detectedAt: -1 });
      await db.collection(COLLECTIONS.syncRuns).createIndex({ state: 1, startedAt: -1 });
      await db.collection(COLLECTIONS.pageContent).createIndex({ key: 1 }, { unique: true });
      await db.collection(COLLECTIONS.faqs).createIndex({ page: 1 }, { unique: true });
      await db.collection(COLLECTIONS.posts).createIndexes([
        { key: { slug: 1 }, unique: true, name: "slug_unique" },
        { key: { published: 1, publishedAt: -1 }, name: "published_date" },
        { key: { category: 1, published: 1, publishedAt: -1 }, name: "category_published_date" },
      ]);
      await db.collection(COLLECTIONS.blogCategories).createIndex({ slug: 1 }, { unique: true });
      await db.collection(COLLECTIONS.settings).createIndex({ key: 1 }, { unique: true });
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}
