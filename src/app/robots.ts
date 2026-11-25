import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { getSiteVisibility } from "@/lib/data";

/**
 * Everything public is crawlable; the admin and APIs are not. Pages that shouldn't be indexed
 * (empty law page, empty blog categories, 404s) say so with a noindex tag instead, so crawlers
 * can still read that tag.
 *
 * When the site is hidden from search engines (admin switch), crawling stays allowed on purpose:
 * Google must be able to fetch pages to see their noindex tag. Only the sitemap link is dropped.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { indexable } = await getSiteVisibility();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] }],
    ...(indexable ? { sitemap: `${SITE_URL}/sitemap.xml` } : {}),
    host: SITE_URL,
  };
}
