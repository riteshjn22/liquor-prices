import type { MetadataRoute } from "next";
import { getSitemapEntries, getTypes } from "@/lib/data";
import { SITE_URL, STATES } from "@/lib/config";

// ~2,600 brand URLs today: well under the 50,000-per-file limit.
// If you add many states, switch to generateSitemaps() to split it.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/prices`, changeFrequency: "weekly", priority: 0.6 },
  ];

  for (const s of STATES) {
    entries.push({ url: `${SITE_URL}/prices/${s.slug}`, changeFrequency: "daily", priority: 0.9 });
    for (const t of await getTypes(s.slug)) {
      entries.push({ url: `${SITE_URL}/prices/${s.slug}/${t.slug}`, changeFrequency: "daily", priority: 0.8 });
    }
  }

  for (const b of await getSitemapEntries()) {
    entries.push({
      url: `${SITE_URL}/prices/${b.state}/${b.typeSlug}/${b.slug}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  return entries;
}
