import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { preconnect } from "react-dom";
import { JsonLd } from "@/components/JsonLd";
import { CATEGORIES } from "@/lib/categories";
import { SITE_NAME, SITE_TAGLINE, SITE_URL, STATES } from "@/lib/config";
import { FEED_PATH, LOCALE, siteGraph } from "@/lib/seo";
import "./globals.css";

const IMAGEKIT_ORIGIN = (() => {
  try {
    return process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ? new URL(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT).origin : null;
  } catch {
    return null;
  }
})();

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const DEFAULT_DESCRIPTION = "Liquor prices in India by brand: whisky, beer, wine, vodka, rum and brandy, with state-wise prices by bottle size, liquor laws and updates.";

// Search console ownership codes (optional): set them in Vercel's environment variables.
const verification: Metadata["verification"] = {
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
  ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
};

/** Defaults for every page; each page sets its own title, description, canonical and share tags (lib/seo.ts). */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "Food & Drink",
  referrer: "strict-origin-when-cross-origin",
  // Pages are indexable by default (no tag needed); this only allows large image previews and full snippets.
  // Keeping index/follow out means 404s and noindex pages never carry a conflicting tag.
  robots: { googleBot: { "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: { type: "website", siteName: SITE_NAME, locale: LOCALE, title: `${SITE_NAME} | ${SITE_TAGLINE}`, description: DEFAULT_DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} | ${SITE_TAGLINE}`, description: DEFAULT_DESCRIPTION },
  alternates: { types: { "application/rss+xml": [{ url: FEED_PATH, title: `${SITE_NAME} blog` }] } },
  formatDetection: { telephone: false, email: false, address: false },
  ...(Object.keys(verification).length ? { verification } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d2037",
  colorScheme: "light",
};

/** "Trendswe Liquor Info" -> Trendswe <gold>Liquor Info</gold> */
function Wordmark({ className = "" }: { className?: string }) {
  const [first, ...rest] = SITE_NAME.split(" ");
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      {first} {rest.length > 0 && <span className="text-gold">{rest.join(" ")}</span>}
    </span>
  );
}

function Header() {
  return (
    <header className="bg-navy-gradient rounded-b-[22px] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-5">
        <Link href="/" className="block">
          <Wordmark className="text-2xl sm:text-[30px]" />
          <span className="block text-xs text-slate-200 sm:text-sm">{SITE_TAGLINE}</span>
        </Link>
        <nav aria-label="Categories" className="hidden gap-5 text-sm font-semibold text-slate-100 lg:flex">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/prices/${c.slug}`} className="hover:text-gold">
              {c.name}
            </Link>
          ))}
          <Link href="/law" className="hover:text-gold">
            Laws
          </Link>
          <Link href="/blog" className="hover:text-gold">
            Blog
          </Link>
        </nav>
        {/* Mobile menu: no JavaScript needed */}
        <details className="relative lg:hidden">
          <summary aria-label="Menu" className="cursor-pointer list-none text-3xl leading-none tracking-widest [&::-webkit-details-marker]:hidden">
            ☰
          </summary>
          <div className="absolute right-0 z-20 mt-3 w-64 rounded-2xl border border-line bg-white p-3 text-ink shadow-xl">
            <ul className="grid grid-cols-2 gap-1 text-sm font-semibold">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link href={`/prices/${c.slug}`} className="block rounded-lg px-2 py-2 hover:bg-tile">
                    {c.emoji} {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/law" className="block rounded-lg px-2 py-2 hover:bg-tile">
                  ⚖️ Laws
                </Link>
              </li>
              <li>
                <Link href="/blog" className="block rounded-lg px-2 py-2 hover:bg-tile">
                  📰 Blog
                </Link>
              </li>
            </ul>
          </div>
        </details>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-navy-gradient mt-12 text-[#e8edf4]">
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-4 sm:px-5">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="col-span-2 sm:col-span-1">
            <Wordmark className="text-[23px]" />
            <p className="mt-2 max-w-md text-sm text-[#d4dce6]">
              Liquor price information for India by brand and bottle size. Official prices come from state excise
              departments; other figures are indicative. We do not sell alcohol.
            </p>
          </div>
          <div>
            <h3 className="mb-2 font-bold">Categories</h3>
            <ul className="space-y-1.5 text-sm text-[#d4dce6]">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link href={`/prices/${c.slug}`} className="hover:underline">
                    {c.name} prices
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-bold">Sources</h3>
            <ul className="space-y-1.5 text-sm text-[#d4dce6]">
              <li>
                <Link href="/prices" className="hover:underline">
                  All liquor prices
                </Link>
              </li>
              <li>
                <Link href="/law" className="hover:underline">
                  Liquor laws
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:underline">
                  Blog
                </Link>
              </li>
              {STATES.map((s) => (
                <li key={s.slug}>
                  <a href={s.sourceUrl} rel="nofollow noopener" target="_blank" className="hover:underline">
                    {s.sourceName}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-6 border-t border-[#627186] pt-3 text-center text-xs text-[#d4dce6]">
          © {SITE_NAME}. Information is for educational purposes only. Always check the MRP printed on the bottle. Drink
          responsibly; for persons of legal drinking age only.
        </p>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Brand and blog images come from ImageKit: open the connection early.
  if (IMAGEKIT_ORIGIN) preconnect(IMAGEKIT_ORIGIN);
  return (
    <html lang="en-IN" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-page text-ink">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-ink focus:shadow">
          Skip to content
        </a>
        <JsonLd data={siteGraph()} />
        <Header />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-5">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
