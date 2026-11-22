import { cacheLife, cacheTag } from "next/cache";
import { PRICES_TAG, SITE_NAME, SITE_URL } from "@/lib/config";
import { coverUrl } from "@/lib/cover";
import { getBlogCategories, getPublishedPosts } from "@/lib/data";
import { FEED_PATH } from "@/lib/seo";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rfc822 = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00+05:30` : d).toUTCString();

/** Built once and cached; refreshed with the rest of the site when posts change. */
async function buildFeed(): Promise<string> {
  "use cache";
  cacheLife("days");
  cacheTag(PRICES_TAG);
  const [posts, categories] = await Promise.all([getPublishedPosts(50), getBlogCategories()]);
  const names = new Map(categories.map((c) => [c.slug, c.name]));
  const items = posts
    .map((p) => {
      const url = `${SITE_URL}/blog/${p.slug}`;
      const img = coverUrl(p.coverImage, 1200, 630);
      const cat = p.category ? names.get(p.category) : undefined;
      return [
        "    <item>",
        `      <title>${esc(p.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${rfc822(p.publishedAt)}</pubDate>`,
        p.excerpt ? `      <description>${esc(p.excerpt)}</description>` : "",
        cat ? `      <category>${esc(cat)}</category>` : "",
        img ? `      <enclosure url="${esc(img)}" type="image/jpeg" length="0" />` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
  const updated = posts[0]?.updatedAt ?? new Date(0).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE_NAME)} blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Liquor prices, dry days, excise rules and updates in India.</description>
    <language>en-in</language>
    <lastBuildDate>${rfc822(updated)}</lastBuildDate>
    <atom:link href="${SITE_URL}${FEED_PATH}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

/** RSS feed of the newest 50 posts at /blog/feed.xml (linked from every page's <head>). */
export async function GET() {
  return new Response(await buildFeed(), { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
