# SEO on this site

Everything below is automatic: it updates when you change brands, prices, pages or posts in the admin.
Shared code lives in `src/lib/seo.ts` (metadata + JSON-LD helpers) and `src/lib/og.tsx` (share images).

## Structured data (schema.org JSON-LD)

| Page | Schema types |
|---|---|
| Every page | `Organization` (name, URL, logo, area served: India) and `WebSite` (name, language en-IN, publisher), linked by `@id` |
| Home `/` | `WebPage` + `ItemList` of the 6 price categories · `FAQPage` when FAQs are added |
| Prices `/prices` | `CollectionPage` + `ItemList` of categories · `BreadcrumbList` · `FAQPage` |
| Category `/prices/<category>` | `CollectionPage` + `ItemList` of every brand (A-Z) · `BreadcrumbList` · `FAQPage` |
| Brand `/prices/<category>/<brand>` | `ItemPage` (date modified) with `Product`: `Brand`, category, description, image, bottle sizes, `AggregateOffer` (INR low / high price, number of prices, states covered) · `BreadcrumbList` · `FAQPage` |
| Law `/law` | `WebPage` + `Article` (headline, date modified, word count, author / publisher) once content is written · `BreadcrumbList` · `FAQPage` |
| Blog `/blog` | `CollectionPage` + `Blog` with its `BlogPosting` list · `BreadcrumbList` · `FAQPage` |
| Blog category `/blog/category/<slug>` | `CollectionPage` (part of the Blog) + `ItemList` of its posts · `BreadcrumbList` |
| Blog post `/blog/<slug>` | `WebPage` + `BlogPosting` (headline, description, published / modified dates, author, publisher, image, category as `articleSection`, word count, language) · `BreadcrumbList` (Home › Blog › Category › Post) · `FAQPage` |

All `@id`s are absolute URLs, so search engines can join the pieces (page → site → organisation → breadcrumb).

## Meta tags (every page)

- Unique `<title>` (with " | Trendswe Liquor Info") and meta description; short blog descriptions are topped up to a useful length
- Canonical URL (absolute, one per page)
- Open Graph: title, description, URL, type (`article` for posts and the law page, with published / modified time and section), site name, locale `en_IN`, image with size and alt
- Twitter / X: `summary_large_image` card with title, description, image
- `max-image-preview:large`, `max-snippet:-1` for Google (large image previews in results)
- `noindex` (still followed) on: empty law page, blog categories without posts, 404 pages, the admin
- **Whole-site switch** in the admin (Pages → Search engines): Noindex puts `noindex, nofollow` on every page, empties the sitemap and drops it from robots.txt; Index restores everything
- RSS feed link in every page's `<head>`
- Optional Google / Bing ownership tags: set `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` in Vercel
- `lang="en-IN"`, viewport, theme colour, no auto-linking of phone numbers

## Share images (Open Graph)

Generated 1200×630 cards, built once at deploy (no runtime cost):

- Site default card (home, prices, law, blog, categories of the blog, posts without a cover)
- Each liquor category: "Whisky Prices in India · 60 brands"
- Each brand: "Old Monk Price in India" with its price range badge
- Blog posts with a cover image use the cover instead

## Technical

- `sitemap.xml`: every indexable page with its last-modified date (from brand, post and page updates), image entries for brand bottles and blog covers; hides drafts, empty pages and the admin
- `robots.txt`: allows everything public, blocks `/admin` and `/api/`, points to the sitemap
- RSS feed `/blog/feed.xml` (newest 50 posts, with categories and cover images)
- Icons: `favicon.ico` (16/32/48), `icon.svg`, Apple touch icon, 512px logo (`/logo.png`), web app manifest
- Breadcrumb navigation on every inner page (visible + structured data)
- One `<h1>` per page; descriptive alt text on brand bottles and blog covers
- Static pages: every page is prerendered and cached, so crawlers always get complete HTML fast
- Clean, lower-case URLs; trailing slashes redirect to the canonical form; real 404 status for unknown pages
- Response headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`; `X-Powered-By` removed
- Early connection to ImageKit (`preconnect`) when it is configured
- "Skip to content" link for keyboard and screen-reader users

## Notes

- Google shows FAQ rich results only for a few authoritative health and government sites; the FAQ markup is still valid and helps other search engines and AI answers.
- After deploying, submit `https://<your-domain>/sitemap.xml` in Google Search Console and Bing Webmaster Tools, and test a brand page in Google's Rich Results Test.
