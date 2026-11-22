import type { Metadata } from "next";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "./config";

/**
 * Shared SEO helpers: page metadata (canonical, Open Graph, Twitter) and schema.org JSON-LD.
 *
 * Next.js replaces a layout's whole `openGraph` / `twitter` object when a page sets its own,
 * so every page builds the full set here instead of relying on the layout.
 */

export const LOCALE = "en_IN";
export const LANGUAGE = "en-IN";
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const BLOG_ID = `${SITE_URL}/blog#blog`;
export const LOGO_URL = `${SITE_URL}/logo.png`;
export const FEED_PATH = "/blog/feed.xml";

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`);

type PageMetaInput = {
  /** Page title without the site name (the layout template adds it). */
  title: string;
  description: string;
  /** Path of the canonical URL, e.g. "/prices/rum". */
  path: string;
  /** Use "article" for blog posts and guides. */
  type?: "website" | "article";
  /** Explicit share images (e.g. a blog cover). Leave out to use the generated share image. */
  images?: { url: string; width?: number; height?: number; alt?: string }[];
  /** The route has its own opengraph-image file. */
  ownImageFile?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  /** Keep the page out of search results (empty or placeholder pages). */
  noindex?: boolean;
};

/**
 * The site's generated share image (app/opengraph-image.tsx). Next.js drops a layout's share image
 * when a page sets its own Open Graph tags, so pages point at it explicitly. Routes with their own
 * opengraph-image file (categories, brands) override this automatically.
 */
const DEFAULT_IMAGES = [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE_NAME}: liquor prices, laws and dry days in India` }];

/** Search engines show about 150-160 characters; short descriptions get a general sentence added. */
export function fullDescription(primary: string, fallback: string): string {
  const p = primary.trim();
  if (p.length >= 70) return p;
  const joined = p ? `${p.replace(/[.!?]?$/, ".")} ${fallback}` : fallback;
  return joined.length > 160 ? `${joined.slice(0, joined.lastIndexOf(" ", 157))}…` : joined;
}

export function pageMetadata(p: PageMetaInput): Metadata {
  const ogTitle = p.title.includes(SITE_NAME) ? p.title : `${p.title} | ${SITE_NAME}`;
  // Routes with their own opengraph-image file (home, categories, brands) let Next.js fill both tags from it.
  const images = p.images ?? (p.ownImageFile ? undefined : DEFAULT_IMAGES);
  return {
    // A title that already names the site (home page) is used as is, without the " | Site" suffix.
    title: p.title.includes(SITE_NAME) ? { absolute: p.title } : p.title,
    description: p.description,
    alternates: { canonical: p.path, types: { "application/rss+xml": [{ url: FEED_PATH, title: `${SITE_NAME} blog` }] } },
    openGraph: {
      type: p.type ?? "website",
      siteName: SITE_NAME,
      locale: LOCALE,
      url: p.path,
      title: ogTitle,
      description: p.description,
      ...(images ? { images } : {}),
      ...(p.type === "article"
        ? { publishedTime: p.publishedTime, modifiedTime: p.modifiedTime, section: p.section, authors: [SITE_URL] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: p.description,
      ...(images ? { images: images.map((i) => i.url) } : {}),
    },
    ...(p.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Plain text from editor HTML, for descriptions in JSON-LD and meta tags. */
export function htmlToText(html: string | null | undefined, max = 300): string {
  const text = (html ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(x27|39);/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trim()}…`;
}

export function wordCount(html: string | null | undefined): number {
  const t = htmlToText(html, 1_000_000);
  return t ? t.split(/\s+/).length : 0;
}

// ---------------------------------------------------------------- JSON-LD

/** Site-wide entities, output once in the root layout; pages point at them by @id. */
export function siteGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: { "@type": "ImageObject", "@id": `${SITE_URL}/#logo`, url: LOGO_URL, contentUrl: LOGO_URL, width: 512, height: 512, caption: SITE_NAME },
        image: { "@id": `${SITE_URL}/#logo` },
        description: SITE_TAGLINE,
        areaServed: { "@type": "Country", name: "India" },
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: SITE_NAME,
        alternateName: SITE_TAGLINE,
        url: `${SITE_URL}/`,
        inLanguage: LANGUAGE,
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

type WebPageInput = {
  type?: "WebPage" | "CollectionPage" | "ItemPage" | "AboutPage" | "FAQPage";
  path: string;
  name: string;
  description?: string;
  dateModified?: string;
  datePublished?: string;
  image?: string;
  /** Pass the page's breadcrumbs so the page links to its BreadcrumbList. */
  hasBreadcrumb?: boolean;
  mainEntity?: object;
  extra?: Record<string, unknown>;
};

/** The page itself, linked to the site, the publisher and (optionally) its breadcrumb trail. */
export function webPageLd(p: WebPageInput) {
  const url = absoluteUrl(p.path);
  return {
    "@context": "https://schema.org",
    "@type": p.type ?? "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: p.name,
    ...(p.description ? { description: p.description } : {}),
    inLanguage: LANGUAGE,
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORG_ID },
    ...(p.datePublished ? { datePublished: p.datePublished } : {}),
    ...(p.dateModified ? { dateModified: p.dateModified } : {}),
    ...(p.image ? { primaryImageOfPage: { "@type": "ImageObject", url: p.image } } : {}),
    ...(p.hasBreadcrumb ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
    ...(p.mainEntity ? { mainEntity: p.mainEntity } : {}),
    ...p.extra,
  };
}

/** Newest date of a list (ISO strings or YYYY-MM-DD); undefined when empty. */
export function latestDate(dates: (string | null | undefined)[]): string | undefined {
  return dates.filter((d): d is string => !!d).sort().at(-1);
}
