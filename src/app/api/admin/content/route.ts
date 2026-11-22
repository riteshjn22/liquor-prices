import { revalidateTag } from "next/cache";
import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";
import { PRICES_TAG } from "@/lib/config";
import { COLLECTIONS, ensureIndexes, getDb } from "@/lib/mongodb";
import { contentSlots, isContentSlot } from "@/lib/pages";
import { isEmptyHtml, toSafeHtml } from "@/lib/rich-text";
import type { PageContent } from "@/lib/types";

/** All editable page sections with their current content. */
export async function GET(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const db = await getDb();
  const docs = (await db.collection<PageContent>(COLLECTIONS.pageContent).find({}, { projection: { _id: 0 } }).toArray()) as PageContent[];
  const byKey = new Map(docs.map((d) => [d.key, d]));
  const slots = contentSlots().map((s) => ({ ...s, title: byKey.get(s.key)?.title ?? "", html: byKey.get(s.key)?.html ?? "", updatedAt: byKey.get(s.key)?.updatedAt ?? null }));
  return Response.json({ slots }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Save one section: { key, html, title? }. Empty content removes it (the page falls back to its default). */
export async function POST(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const body = (await request.json().catch(() => null)) as { key?: unknown; html?: unknown; title?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key : "";
  if (!isContentSlot(key)) return Response.json({ error: "Unknown page section." }, { status: 400 });
  const raw = typeof body?.html === "string" ? body.html : "";
  if (raw.length > 200_000) return Response.json({ error: "Content is too long (max 200,000 characters)." }, { status: 413 });
  const html = toSafeHtml(raw);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 150) : "";

  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<PageContent>(COLLECTIONS.pageContent);
  if (isEmptyHtml(html) && !title) await col.deleteOne({ key });
  else await col.updateOne({ key }, { $set: { key, html, title, updatedAt: new Date().toISOString() } }, { upsert: true });

  revalidateTag(PRICES_TAG, { expire: 0 });
  return Response.json({ saved: true, html, title });
}
