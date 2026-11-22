import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

/**
 * Everything public is crawlable; the admin and APIs are not. Pages that shouldn't be indexed
 * (empty law page, empty blog categories, 404s) say so with a noindex tag instead, so crawlers
 * can still read that tag.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
