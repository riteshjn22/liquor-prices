/**
 * Link brand photos uploaded to ImageKit to their brand pages.
 *
 * 1. In ImageKit, upload images into folders named after the URL:
 *      /brands/<state>/<type>/<brand-slug>.jpg   (png/webp also fine)
 *    e.g. /brands/delhi/whisky/royal-stag-barrel-select-whisky.jpg
 *    (the brand slug is the last part of the brand page URL)
 * 2. Run:  npm run images:link
 *
 * Needs IMAGEKIT_PRIVATE_KEY (ImageKit > Developer options) in .env.local.
 * The private key is only used here, never in the website.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { COLLECTIONS, getClient, getDb } from "../src/lib/mongodb";

type IkFile = { filePath: string; fileType: string };

async function listFiles(privateKey: string): Promise<IkFile[]> {
  const auth = Buffer.from(`${privateKey}:`).toString("base64");
  const files: IkFile[] = [];
  for (let skip = 0; ; skip += 1000) {
    const url = `https://api.imagekit.io/v1/files?path=${encodeURIComponent("/brands")}&fileType=image&limit=1000&skip=${skip}`;
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) throw new Error(`ImageKit API ${res.status}: ${await res.text()}`);
    const page = (await res.json()) as IkFile[];
    files.push(...page);
    if (page.length < 1000) break;
  }
  return files;
}

async function main() {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) throw new Error("Set IMAGEKIT_PRIVATE_KEY in .env.local");

  const files = await listFiles(privateKey);
  console.log(`[images] ${files.length} images found under /brands`);

  const db = await getDb();
  const brands = db.collection(COLLECTIONS.brands);
  let linked = 0;
  const unmatched: string[] = [];
  const linkedPaths: string[] = [];

  for (const f of files) {
    const m = f.filePath.match(/^\/brands\/([^/]+)\/([^/]+)\/([^/]+)\.[a-z0-9]+$/i);
    if (!m) {
      unmatched.push(f.filePath);
      continue;
    }
    const key = `${m[1]}/${m[2]}/${m[3].toLowerCase()}`;
    const res = await brands.updateOne({ key }, { $set: { image: f.filePath } });
    if (res.matchedCount) {
      linked++;
      linkedPaths.push(f.filePath);
    } else unmatched.push(f.filePath);
  }

  // Images deleted from ImageKit: unlink so pages fall back to the placeholder.
  const cleared = await brands.updateMany(
    { image: { $regex: "^/brands/", $nin: linkedPaths } },
    { $set: { image: null } },
  );

  console.log(`[images] linked ${linked}, unlinked ${cleared.modifiedCount}`);
  if (unmatched.length) console.log(`[images] no matching brand for:\n  ${unmatched.join("\n  ")}`);

  const site = process.env.SITE_URL_FOR_REVALIDATE;
  const secret = process.env.REVALIDATE_SECRET;
  if (site && secret) {
    const res = await fetch(`${site.replace(/\/+$/, "")}/api/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    console.log(`[images] revalidate ${site}: HTTP ${res.status}`);
  }
  await (await getClient()).close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
