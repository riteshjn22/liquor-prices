/**
 * Copy everything from your local database to another one (e.g. MongoDB Atlas before going live):
 * brands, prices, Delhi products, FAQs, page content, blog posts and categories, settings, history.
 *
 *   npm run db:copy -- "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/"
 *   npm run db:copy -- "<target uri>" --replace     (overwrite a target that already has data)
 *
 * Source: MONGODB_URI / MONGODB_DB from .env.local (your local database).
 * Target database name: same as the source (MONGODB_DB, default "liquor").
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { MongoClient } from "mongodb";
import { COLLECTIONS, ensureIndexes } from "../src/lib/mongodb";

const mask = (uri: string) => uri.replace(/\/\/([^:/@]+):([^@]+)@/, "//$1:****@");

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => /^mongodb(\+srv)?:\/\//.test(a));
  const replace = args.includes("--replace");
  const source = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "liquor";
  // Optional different database name on the target (mainly for testing): --to-db <name>
  const toDbArg = args.indexOf("--to-db");
  const targetDbName = toDbArg >= 0 && args[toDbArg + 1] ? args[toDbArg + 1] : dbName;

  if (!source) throw new Error("MONGODB_URI is not set in .env.local (the local database to copy from).");
  if (!target) throw new Error('Give the target connection string: npm run db:copy -- "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/"');
  if (target.replace(/\/+$/, "") === source.replace(/\/+$/, "")) throw new Error("Source and target are the same database.");

  console.log(`[copy] from ${mask(source)} (${dbName})`);
  console.log(`[copy] to   ${mask(target)} (${targetDbName})`);
  const [from, to] = await Promise.all([new MongoClient(source).connect(), new MongoClient(target, { serverSelectionTimeoutMS: 15_000 }).connect()]);
  try {
    const src = from.db(dbName);
    const dst = to.db(targetDbName);
    const names = Object.values(COLLECTIONS);

    // The same database can hide behind two addresses (localhost vs 127.0.0.1): copying onto
    // itself with --replace would erase it. Leave a marker in the source and look for it in the target.
    const marker = `copy-check-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await src.collection("_copy_check").insertOne({ marker });
    const sameDb = !!(await dst.collection("_copy_check").findOne({ marker }));
    await src.collection("_copy_check").drop().catch(() => undefined);
    if (sameDb) throw new Error("The target is the same database as the source (just a different address). Nothing was copied.");

    // Refuse to mix data unless asked: an existing live database is never silently overwritten.
    if (!replace) {
      const busy: string[] = [];
      for (const n of names) if (await dst.collection(n).estimatedDocumentCount()) busy.push(n);
      if (busy.length) throw new Error(`The target already has data in: ${busy.join(", ")}. Run again with --replace to overwrite it.`);
    }

    for (const n of names) {
      const docs = await src.collection(n).find({}).toArray();
      const col = dst.collection(n);
      if (replace) await col.deleteMany({});
      for (let i = 0; i < docs.length; i += 1000) await col.insertMany(docs.slice(i, i + 1000), { ordered: false });
      console.log(`[copy] ${n.padEnd(16)} ${docs.length}`);
    }
    await ensureIndexes(dst);
    console.log("[copy] indexes created. Done.");
  } finally {
    await Promise.all([from.close(), to.close()]);
  }
}

main().catch((err) => {
  console.error(`[copy] ${(err as Error).message}`);
  process.exit(1);
});
