/**
 * Local MongoDB for development, no install needed.
 *   npm run db   -> starts MongoDB on mongodb://127.0.0.1:27017 (data kept in .data/mongo)
 * Leave it running in its own terminal. In production use MongoDB Atlas instead.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
// The "-core" package has no install script, so `npm install` (and Vercel builds)
// never download MongoDB. The binary (~800 MB) downloads on the first `npm run db` only.
import { MongoMemoryServer } from "mongodb-memory-server-core";

async function main() {
  const dbPath = resolve(".data/mongo");
  mkdirSync(dbPath, { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { port: 27017, ip: "127.0.0.1", dbPath, storageEngine: "wiredTiger" },
  });
  console.log(`[db] MongoDB running at ${server.getUri()} (data: ${dbPath})`);
  console.log("[db] Press Ctrl+C to stop.");

  const stop = async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
