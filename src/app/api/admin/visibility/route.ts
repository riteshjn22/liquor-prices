import { revalidateTag } from "next/cache";
import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";
import { PRICES_TAG } from "@/lib/config";
import { SITE_VISIBILITY_KEY } from "@/lib/data";
import { COLLECTIONS, ensureIndexes, getDb } from "@/lib/mongodb";

type VisibilityDoc = { key: string; indexable: boolean; updatedAt: string };

/** Is the site open to search engines? */
export async function GET(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const db = await getDb();
  const doc = await db.collection<VisibilityDoc>(COLLECTIONS.settings).findOne({ key: SITE_VISIBILITY_KEY });
  return Response.json({ indexable: doc?.indexable !== false, updatedAt: doc?.updatedAt ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

/** { indexable: true | false }. Refreshes every page, robots.txt and the sitemap. */
export async function POST(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const body = (await request.json().catch(() => null)) as { indexable?: unknown } | null;
  if (typeof body?.indexable !== "boolean") return Response.json({ error: "indexable must be true or false." }, { status: 400 });
  const db = await getDb();
  await ensureIndexes(db);
  const updatedAt = new Date().toISOString();
  await db.collection<VisibilityDoc>(COLLECTIONS.settings).updateOne({ key: SITE_VISIBILITY_KEY }, { $set: { key: SITE_VISIBILITY_KEY, indexable: body.indexable, updatedAt } }, { upsert: true });
  revalidateTag(PRICES_TAG, { expire: 0 });
  return Response.json({ saved: true, indexable: body.indexable, updatedAt });
}
