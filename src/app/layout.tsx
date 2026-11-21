import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { SITE_NAME, SITE_URL, STATES } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: Official Liquor MRP Price List`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Official MRP of whisky, beer, rum, vodka, wine and more, taken from state excise department price lists and updated daily.",
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN" },
  twitter: { card: "summary" },
  formatDetection: { telephone: false },
};

function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          <span className="text-amber-700">₹</span> {SITE_NAME}
        </Link>
        <nav className="flex gap-4 text-sm text-slate-600">
          {STATES.map((s) => (
            <Link key={s.slug} href={`/prices/${s.slug}`} className="hover:text-amber-700">
              {s.name} prices
            </Link>
          ))}
        </nav>
        <form action="/search" method="get" role="search" className="ml-auto flex w-full sm:w-auto">
          <label htmlFor="site-search" className="sr-only">Search brands</label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search a brand, e.g. Old Monk"
            className="w-full rounded-l-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-600 sm:w-64"
          />
          <button type="submit" className="rounded-r-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
            Search
          </button>
        </form>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-slate-900">{SITE_NAME}</p>
          <p className="mt-2">
            Prices are the official maximum retail prices (MRP) published by state excise departments. We do not sell
            alcohol.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Data sources</p>
          <ul className="mt-2 space-y-1">
            {STATES.map((s) => (
              <li key={s.slug}>
                <a href={s.sourceUrl} rel="nofollow noopener" target="_blank" className="hover:text-amber-700 hover:underline">
                  {s.sourceName}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Disclaimer</p>
          <p className="mt-2">
            Prices may change after a new excise notification. Always check the MRP printed on the bottle. Drink
            responsibly; for persons of legal drinking age only.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-800">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
