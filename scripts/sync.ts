/**
 * Run the price sync from the command line (locally or in GitHub Actions).
 *   npm run sync            -> sync every configured state
 *   npm run sync -- --force -> re-write even if the source data is unchanged
 *
 * If SITE_URL_FOR_REVALIDATE and REVALIDATE_SECRET are set, it also tells the
 * deployed site to refresh its cached pages.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { STATES } from "../src/lib/config";
import { getClient } from "../src/lib/mongodb";
import { runSync } from "../src/lib/sync";

async function main() {
  const force = process.argv.includes("--force");
  let failed = false;
  for (const s of STATES) {
    console.log(`[sync] ${s.name}: fetching...`);
    const r = await runSync(s.slug, { force });
    console.log(`[sync] ${s.name}:`, JSON.stringify(r));
    if (r.status === "failed") failed = true;
  }

  const site = process.env.SITE_URL_FOR_REVALIDATE;
  const secret = process.env.REVALIDATE_SECRET;
  if (!failed && site && secret) {
    const res = await fetch(`${site.replace(/\/+$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    console.log(`[sync] revalidate ${site}: HTTP ${res.status}`);
  }

  await (await getClient()).close();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
