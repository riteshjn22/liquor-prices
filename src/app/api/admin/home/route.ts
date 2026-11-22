import { revalidateTag } from "next/cache";
import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";
import { DEFAULT_HOME_CARDS, isValidLink, mergeHomeCards } from "@/lib/blog";
import { PRICES_TAG } from "@/lib/config";
import { COLLECTIONS, ensureIndexes, getDb } from "@/lib/mongodb";
import type { HomeCard } from "@/lib/types";

type SettingsDoc = { key: string; cards?: Partial<HomeCard>[]; updatedAt?: string };
const KEY = "home:cards";

/** The home page "Explore Information" cards (saved values merged over the defaults). */
export async function GET(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const db = await getDb();
  const doc = await db.collection<SettingsDoc>(COLLECTIONS.settings).findOne({ key: KEY });
  return Response.json({ cards: mergeHomeCards(doc?.cards), defaults: DEFAULT_HOME_CARDS }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Save { cards: [{ id, title, subtitle, href }] }. Links must be a path on this site (/…) or https://. */
export async function POST(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const body = (await request.json().catch(() => null)) as { cards?: unknown } | null;
  if (!Array.isArray(body?.cards)) return Response.json({ error: "Invalid request." }, { status: 400 });

  const cards: HomeCard[] = [];
  for (const d of DEFAULT_HOME_CARDS) {
    const c = (body.cards as Partial<HomeCard>[]).find((x) => x && x.id === d.id);
    if (!c) {
      cards.push(d); // not sent: keep the default
      continue;
    }
    const title = typeof c?.title === "string" ? c.title.trim().slice(0, 60) : "";
    const subtitle = typeof c?.subtitle === "string" ? c.subtitle.trim().slice(0, 100) : "";
    const href = typeof c?.href === "string" ? c.href.trim().slice(0, 500) : "";
    if (href && !isValidLink(href)) return Response.json({ error: `"${title || d.title}" link must start with / (a page on this site) or https://.` }, { status: 400 });
    cards.push({ id: d.id, title: title || d.title, subtitle, href: href || d.href });
  }

  const db = await getDb();
  await ensureIndexes(db);
  await db.collection<SettingsDoc>(COLLECTIONS.settings).updateOne({ key: KEY }, { $set: { key: KEY, cards, updatedAt: new Date().toISOString() } }, { upsert: true });
  revalidateTag(PRICES_TAG, { expire: 0 });
  return Response.json({ saved: true, cards });
}
