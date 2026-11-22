import { revalidateTag } from "next/cache";
import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";
import { PRICES_TAG } from "@/lib/config";
import { COLLECTIONS, ensureIndexes, getDb } from "@/lib/mongodb";
import { slugify } from "@/lib/normalize";
import { toSafeHtml } from "@/lib/rich-text";
import { RESERVED_POST_SLUGS } from "@/lib/blog";
import type { BlogCategory, BlogPost, FaqDoc } from "@/lib/types";

const noStore = { headers: { "Cache-Control": "private, no-store" } };

/** All posts (drafts too), or ?slug=… for one post with its body. */
export async function GET(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const db = await getDb();
  const slug = new URL(request.url).searchParams.get("slug");
  const col = db.collection<BlogPost>(COLLECTIONS.posts);
  if (slug) {
    const post = await col.findOne({ slug }, { projection: { _id: 0 } });
    return post ? Response.json({ post }, noStore) : Response.json({ error: "Unknown post." }, { status: 404 });
  }
  const posts = await col
    .find({}, { projection: { _id: 0, slug: 1, title: 1, category: 1, published: 1, publishedAt: 1, updatedAt: 1 } })
    .sort({ publishedAt: -1, createdAt: -1 })
    .toArray();
  return Response.json({ posts }, noStore);
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Create or update a post. Send `originalSlug` when editing, so the slug can be changed
 * (its FAQs move with it). Body HTML is sanitized before saving.
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return Response.json({ error: "Invalid request." }, { status: 400 });

  const title = str(b.title, 200);
  if (!title) return Response.json({ error: "Title is required." }, { status: 400 });
  const slug = slugify(str(b.slug, 120) || title);
  if (!slug) return Response.json({ error: "The URL slug needs letters or numbers." }, { status: 400 });
  if (RESERVED_POST_SLUGS.has(slug)) return Response.json({ error: `/blog/${slug} is reserved; choose another URL.` }, { status: 400 });
  const publishedAt = str(b.publishedAt, 10);
  if (publishedAt && !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) return Response.json({ error: "Publish date must be YYYY-MM-DD." }, { status: 400 });
  const coverImage = str(b.coverImage, 500);
  if (coverImage && !/^(\/[^\s]*|https:\/\/[^\s]+)$/.test(coverImage)) return Response.json({ error: "Cover image must be an ImageKit path starting with / or an https:// URL." }, { status: 400 });
  const rawHtml = typeof b.html === "string" ? b.html : "";
  if (rawHtml.length > 500_000) return Response.json({ error: "The post is too long." }, { status: 413 });

  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<BlogPost>(COLLECTIONS.posts);
  const originalSlug = str(b.originalSlug, 120);
  const existing = originalSlug ? await col.findOne({ slug: originalSlug }) : null;
  if (originalSlug && !existing) return Response.json({ error: "The post you are editing no longer exists." }, { status: 404 });
  if (slug !== originalSlug && (await col.countDocuments({ slug }))) return Response.json({ error: `Another post already uses the URL /blog/${slug}.` }, { status: 409 });

  const category = str(b.category, 80);
  if (category && !(await db.collection<BlogCategory>(COLLECTIONS.blogCategories).countDocuments({ slug: category }))) {
    return Response.json({ error: "That blog category no longer exists. Reload and pick another." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const doc: Omit<BlogPost, "createdAt"> = {
    slug,
    title,
    excerpt: str(b.excerpt, 400),
    coverImage,
    html: toSafeHtml(rawHtml),
    published: b.published === true,
    publishedAt: publishedAt || now.slice(0, 10),
    seoTitle: str(b.seoTitle, 120) || undefined,
    seoDescription: str(b.seoDescription, 320) || undefined,
    updatedAt: now,
  };
  // Left out (not undefined) when empty, so it can be $unset without a conflict.
  if (category) doc.category = category;
  if (existing) {
    await col.updateOne({ slug: originalSlug }, category ? { $set: doc } : { $set: doc, $unset: { category: "" } });
    if (slug !== originalSlug) await db.collection<FaqDoc>(COLLECTIONS.faqs).updateOne({ page: `post:${originalSlug}` }, { $set: { page: `post:${slug}` } });
  } else {
    await col.insertOne({ ...doc, createdAt: now });
  }
  revalidateTag(PRICES_TAG, { expire: 0 });
  return Response.json({ saved: true, slug });
}

/** Delete ?slug=… (and its FAQs). */
export async function DELETE(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const db = await getDb();
  const res = await db.collection<BlogPost>(COLLECTIONS.posts).deleteOne({ slug });
  if (!res.deletedCount) return Response.json({ error: "Unknown post." }, { status: 404 });
  await db.collection<FaqDoc>(COLLECTIONS.faqs).deleteOne({ page: `post:${slug}` });
  revalidateTag(PRICES_TAG, { expire: 0 });
  return Response.json({ deleted: slug });
}
