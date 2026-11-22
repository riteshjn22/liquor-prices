import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { SITE_URL } from "@/lib/config";
import { getBlogCategories, getPageContent, getPublishedPosts, getSitemapEntries } from "@/lib/data";

// Only enabled brands are listed. Well under the 50,000-URL limit per sitemap.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/prices`, changeFrequency: "daily", priority: 0.9 },
    ...CATEGORIES.map((c) => ({ url: `${SITE_URL}/prices/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
  // The law page is listed once it has content; until then it is noindex.
  if (await getPageContent("law:body")) entries.push({ url: `${SITE_URL}/law`, changeFrequency: "monthly", priority: 0.6 });
  const posts = await getPublishedPosts();
  if (posts.length) entries.push({ url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.6 });
  for (const c of await getBlogCategories()) if (c.postCount) entries.push({ url: `${SITE_URL}/blog/category/${c.slug}`, changeFrequency: "weekly", priority: 0.5 });
  for (const p of posts) entries.push({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly", priority: 0.6 });
  for (const b of await getSitemapEntries()) {
    entries.push({ url: `${SITE_URL}/prices/${b.category}/${b.slug}`, lastModified: b.updatedAt, changeFrequency: "weekly", priority: 0.7 });
  }
  return entries;
}
