import { revalidateTag } from "next/cache";
import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";
import { isPillColor } from "@/lib/blog";
import { PRICES_TAG } from "@/lib/config";
import { COLLECTIONS, ensureIndexes, getDb } from "@/lib/mongodb";
import { slugify } from "@/lib/normalize";
import type { BlogCategory, BlogPost } from "@/lib/types";

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** All categories (admin order) with how many posts (drafts too) use each. */
export async function GET(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const db = await getDb();
  const [cats, counts] = await Promise.all([
    db.collection<BlogCategory>(COLLECTIONS.blogCategories).find({}, { projection: { _id: 0 } }).sort({ order: 1, name: 1 }).toArray(),
    db.collection<BlogPost>(COLLECTIONS.posts).aggregate<{ _id: string; n: number }>([{ $group: { _id: "$category", n: { $sum: 1 } } }]).toArray(),
  ]);
  const bySlug = new Map(counts.map((c) => [c._id, c.n]));
  return Response.json({ categories: cats.map((c) => ({ ...c, postCount: bySlug.get(c.slug) ?? 0 })) }, noStore);
}

/**
 * Create or update a category: { originalSlug?, name, slug?, description?, color?, order? }.
 * Changing the slug moves its posts to the new slug.
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return Response.json({ error: "Invalid request." }, { status: 400 });
  const name = str(b.name, 80);
  if (!name) return Response.json({ error: "Category name is required." }, { status: 400 });
  const slug = slugify(str(b.slug, 80) || name);
  if (!slug) return Response.json({ error: "The URL slug needs letters or numbers." }, { status: 400 });

  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<BlogCategory>(COLLECTIONS.blogCategories);
  const originalSlug = str(b.originalSlug, 80);
  const existing = originalSlug ? await col.findOne({ slug: originalSlug }) : null;
  if (originalSlug && !existing) return Response.json({ error: "The category you are editing no longer exists." }, { status: 404 });
  if (slug !== originalSlug && (await col.countDocuments({ slug }))) return Response.json({ error: `Another category already uses /blog/category/${slug}.` }, { status: 409 });

  const order = typeof b.order === "number" && Number.isFinite(b.order) ? Math.round(b.order) : (existing?.order ?? (await col.countDocuments()) + 1);
  const doc: BlogCategory = {
    slug,
    name,
    description: str(b.description, 400),
    color: isPillColor(b.color) ? b.color : "blue",
    order,
    updatedAt: new Date().toISOString(),
  };
  if (existing) {
    await col.updateOne({ slug: originalSlug }, { $set: doc });
    if (slug !== originalSlug) await db.collection<BlogPost>(COLLECTIONS.posts).updateMany({ category: originalSlug }, { $set: { category: slug } });
  } else {
    await col.insertOne(doc);
  }
  revalidateTag(PRICES_TAG, { expire: 0 });
  return Response.json({ saved: true, slug });
}

/** Delete ?slug=…; its posts stay, without a category. */
export async function DELETE(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const db = await getDb();
  const res = await db.collection<BlogCategory>(COLLECTIONS.blogCategories).deleteOne({ slug });
  if (!res.deletedCount) return Response.json({ error: "Unknown category." }, { status: 404 });
  const moved = await db.collection<BlogPost>(COLLECTIONS.posts).updateMany({ category: slug }, { $unset: { category: "" } });
  revalidateTag(PRICES_TAG, { expire: 0 });
  return Response.json({ deleted: slug, postsUncategorised: moved.modifiedCount });
}
