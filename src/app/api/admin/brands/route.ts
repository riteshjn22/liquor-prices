import { revalidateTag } from "next/cache";
import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";
import { PRICES_TAG } from "@/lib/config";
import { COLLECTIONS, getDb } from "@/lib/mongodb";
import type { BrandDoc, ProductDoc, StatePrice } from "@/lib/types";

export type AdminBrandRow = Pick<BrandDoc, "key" | "category" | "name" | "enabled" | "priceText" | "priceNote"> & {
  products: number;
  statePrices: number;
};

/** All brands (enabled and disabled) for the admin table. */
export async function GET(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const db = await getDb();
  const [brands, productCounts, priceCounts] = await Promise.all([
    db
      .collection<BrandDoc>(COLLECTIONS.brands)
      .find({}, { projection: { _id: 0, key: 1, category: 1, name: 1, enabled: 1, priceText: 1, priceNote: 1 } })
      .collation({ locale: "en" })
      .sort({ category: 1, name: 1 })
      .toArray(),
    db.collection<ProductDoc>(COLLECTIONS.products).aggregate<{ _id: string; n: number }>([{ $match: { brandKey: { $ne: null } } }, { $group: { _id: "$brandKey", n: { $sum: 1 } } }]).toArray(),
    db.collection<StatePrice>(COLLECTIONS.statePrices).aggregate<{ _id: string; n: number }>([{ $group: { _id: "$brandKey", n: { $sum: 1 } } }]).toArray(),
  ]);
  const pc = new Map(productCounts.map((c) => [c._id, c.n]));
  const sc = new Map(priceCounts.map((c) => [c._id, c.n]));
  const rows: AdminBrandRow[] = (brands as unknown as BrandDoc[]).map((b) => ({
    key: b.key,
    category: b.category,
    name: b.name,
    enabled: b.enabled,
    priceText: b.priceText ?? "",
    priceNote: b.priceNote ?? "",
    products: pc.get(b.key) ?? 0,
    statePrices: sc.get(b.key) ?? 0,
  }));
  return Response.json({ brands: rows }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Enable or disable brands: { keys: string[], enabled: boolean } */
export async function POST(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const body = (await request.json().catch(() => null)) as { keys?: unknown; enabled?: unknown } | null;
  const keys = Array.isArray(body?.keys) ? body.keys.filter((k): k is string => typeof k === "string").slice(0, 5000) : [];
  if (!keys.length || typeof body?.enabled !== "boolean") {
    return Response.json({ error: 'Send { "keys": ["rum/old-monk"], "enabled": true }' }, { status: 400 });
  }
  const db = await getDb();
  const res = await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .updateMany({ key: { $in: keys } }, { $set: { enabled: body.enabled, updatedAt: new Date().toISOString() } });
  revalidateTag(PRICES_TAG, { expire: 0 });
  return Response.json({ updated: res.modifiedCount, matched: res.matchedCount });
}
