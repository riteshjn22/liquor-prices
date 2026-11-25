import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { SITE_URL } from "@/lib/config";
import { coverUrl } from "@/lib/cover";
import { getBlogCategories, getPageContent, getPublishedPosts, getSitemapEntries, getSiteVisibility } from "@/lib/data";
import { imageKitEnabled, imageKitUrl } from "@/lib/imagekit";
import { latestDate } from "@/lib/seo";

/**
 * Every indexable page with its last-modified date, plus image entries (brand bottles, blog covers)
 * for Google Images. Pages that are noindex (empty law page, empty categories, drafts) are left out.
 * Well under the 50,000-URL limit per sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Hidden from search engines (admin switch): list nothing.
  if (!(await getSiteVisibility()).indexable) return [];
  const [brands, posts, blogCategories, law] = await Promise.all([getSitemapEntries(), getPublishedPosts(), getBlogCategories(), getPageContent("law:body")]);

  const brandDate = (category?: string) => latestDate(brands.filter((b) => !category || b.category === category).map((b) => b.updatedAt));
  const siteDate = latestDate([brandDate(), ...posts.map((p) => p.updatedAt), law?.updatedAt]);

  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: siteDate, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/prices`, lastModified: brandDate(), changeFrequency: "daily", priority: 0.9 },
    ...CATEGORIES.map((c) => ({ url: `${SITE_URL}/prices/${c.slug}`, lastModified: brandDate(c.slug), changeFrequency: "daily" as const, priority: 0.8 })),
  ];

  for (const b of brands) {
    entries.push({
      url: `${SITE_URL}/prices/${b.category}/${b.slug}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
      ...(b.image && imageKitEnabled ? { images: [imageKitUrl(b.image, 800, 800)] } : {}),
    });
  }

  // The law page is listed once it has content; until then it is noindex.
  if (law) entries.push({ url: `${SITE_URL}/law`, lastModified: law.updatedAt, changeFrequency: "monthly", priority: 0.6 });

  if (posts.length) entries.push({ url: `${SITE_URL}/blog`, lastModified: latestDate(posts.map((p) => p.updatedAt)), changeFrequency: "weekly", priority: 0.6 });
  for (const c of blogCategories) {
    if (!c.postCount) continue;
    const inCat = posts.filter((p) => p.category === c.slug);
    entries.push({ url: `${SITE_URL}/blog/category/${c.slug}`, lastModified: latestDate(inCat.map((p) => p.updatedAt)), changeFrequency: "weekly", priority: 0.5 });
  }
  for (const p of posts) {
    const img = coverUrl(p.coverImage, 1200, 630);
    entries.push({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly", priority: 0.6, ...(img ? { images: [img] } : {}) });
  }
  return entries;
}
