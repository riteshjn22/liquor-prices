import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { PRICES_TAG, STATES } from "@/lib/config";
import { runSync } from "@/lib/sync";

// Vercel Hobby allows up to 60s per function. The Delhi feed takes ~10-20s.
export const maxDuration = 60;

/**
 * Fetches the latest excise prices. NOT scheduled: vercel.json has no cron, so it runs only when called by hand:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" https://your-site/api/cron/sync
 * To schedule it again, add a "crons" entry for /api/cron/sync to vercel.json.
 * Add ?force=1 to rewrite data even when the source hasn't changed.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const results = [];
  // Two 25s attempts fit inside the 60s limit with room for the database write.
  // The GitHub Actions workflow is the no-time-limit backup if both fail.
  for (const s of STATES) results.push(await runSync(s.slug, { force, fetch: { attempts: 2, timeoutMs: 25_000 } }));

  if (results.some((r) => r.status === "updated")) {
    // Serve the old pages while fresh ones render in the background.
    revalidateTag(PRICES_TAG, "max");
  }
  const failed = results.some((r) => r.status === "failed");
  return Response.json({ ok: !failed, results }, { status: failed ? 500 : 200 });
}
