import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { CATEGORIES } from "@/lib/categories";
import { SITE_NAME, SITE_TAGLINE, SITE_URL, STATES } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: "Liquor prices in India by brand: whisky, beer, wine, vodka, rum and brandy, with official state excise MRPs where available.",
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN" },
  twitter: { card: "summary" },
  formatDetection: { telephone: false },
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

function SearchForm({ id, className = "" }: { id: string; className?: string }) {
  return (
    <form action="/search" method="get" role="search" className={`flex ${className}`}>
      <label htmlFor={id} className="sr-only">
        Search brands
      </label>
      <input
        id={id}
        name="q"
        type="search"
        placeholder="Search a brand, e.g. Old Monk"
        className="w-full rounded-l-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-slate-300 outline-none focus:bg-white focus:text-ink"
      />
      <button type="submit" className="rounded-r-full bg-gold px-4 text-sm font-bold text-navy hover:brightness-105">
        Search
      </button>
    </form>
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
        </nav>
        <SearchForm id="header-search" className="hidden w-64 md:flex" />
        {/* Mobile menu: no JavaScript needed */}
        <details className="relative lg:hidden">
          <summary aria-label="Menu" className="cursor-pointer list-none text-3xl leading-none tracking-widest [&::-webkit-details-marker]:hidden">
            ☰
          </summary>
          <div className="absolute right-0 z-20 mt-3 w-64 rounded-2xl border border-line bg-white p-3 text-ink shadow-xl">
            <SearchForm id="mobile-search" className="mb-3 [&_input]:border-line [&_input]:bg-tile [&_input]:text-ink [&_input]:placeholder:text-muted" />
            <ul className="grid grid-cols-2 gap-1 text-sm font-semibold">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link href={`/prices/${c.slug}`} className="block rounded-lg px-2 py-2 hover:bg-tile">
                    {c.emoji} {c.name}
                  </Link>
                </li>
              ))}
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
  return (
    <html lang="en-IN" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-page text-ink">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-5">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
