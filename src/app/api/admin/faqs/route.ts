import { revalidateTag } from "next/cache";
import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";
import { PRICES_TAG } from "@/lib/config";
import { COLLECTIONS, ensureIndexes, getDb } from "@/lib/mongodb";
import { isFaqPage } from "@/lib/pages";
import type { BlogPost, BrandDoc, Faq, FaqDoc } from "@/lib/types";

const MAX_ITEMS = 50;
const MAX_Q = 300;
const MAX_A = 3000;

/** ?page=prices -> that page's FAQs. No page -> how many FAQs each page has. */
export async function GET(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const db = await getDb();
  const page = new URL(request.url).searchParams.get("page");
  if (page) {
    const doc = await db.collection<FaqDoc>(COLLECTIONS.faqs).findOne({ page }, { projection: { _id: 0 } });
    return Response.json({ page, items: doc?.items ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const docs = await db.collection<FaqDoc>(COLLECTIONS.faqs).find({}, { projection: { _id: 0, page: 1, items: 1 } }).toArray();
  return Response.json({ counts: Object.fromEntries(docs.map((d) => [d.page, d.items.length])) }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Replace a page's FAQs: { page, items: [{ q, a }, ...] } in display order. An empty list removes them. */
export async function POST(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const body = (await request.json().catch(() => null)) as { page?: unknown; items?: unknown } | null;
  const page = typeof body?.page === "string" ? body.page : "";
  if (!isFaqPage(page)) return Response.json({ error: "Unknown page." }, { status: 400 });

  const db = await getDb();
  await ensureIndexes(db);
  // Brand and post pages must exist.
  if (page.startsWith("brand:") && !(await db.collection<BrandDoc>(COLLECTIONS.brands).countDocuments({ key: page.slice(6) })))
    return Response.json({ error: "Unknown brand." }, { status: 400 });
  if (page.startsWith("post:") && !(await db.collection<BlogPost>(COLLECTIONS.posts).countDocuments({ slug: page.slice(5) })))
    return Response.json({ error: "Unknown blog post." }, { status: 400 });

  const raw = Array.isArray(body?.items) ? body.items : [];
  const items: Faq[] = [];
  for (const [i, it] of raw.entries()) {
    const q = typeof it?.q === "string" ? it.q.trim() : "";
    const a = typeof it?.a === "string" ? it.a.trim() : "";
    if (!q && !a) continue; // empty row
    if (!q || !a) return Response.json({ error: `FAQ ${i + 1}: both the question and the answer are needed.` }, { status: 400 });
    if (q.length > MAX_Q) return Response.json({ error: `FAQ ${i + 1}: the question is over ${MAX_Q} characters.` }, { status: 400 });
    if (a.length > MAX_A) return Response.json({ error: `FAQ ${i + 1}: the answer is over ${MAX_A} characters.` }, { status: 400 });
    items.push({ q, a });
  }
  if (items.length > MAX_ITEMS) return Response.json({ error: `A page can have up to ${MAX_ITEMS} FAQs.` }, { status: 400 });

  const col = db.collection<FaqDoc>(COLLECTIONS.faqs);
  if (!items.length) await col.deleteOne({ page });
  else await col.updateOne({ page }, { $set: { page, items, updatedAt: new Date().toISOString() } }, { upsert: true });
  revalidateTag(PRICES_TAG, { expire: 0 });
  return Response.json({ saved: items.length });
}
