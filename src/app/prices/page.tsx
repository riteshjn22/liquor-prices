import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Faq } from "@/components/Blocks";
import { JsonLd } from "@/components/JsonLd";
import { RichText } from "@/components/RichText";
import { CATEGORIES } from "@/lib/categories";
import { SITE_URL } from "@/lib/config";
import { getCategorySummaries, getFaqs, getPageContent } from "@/lib/data";
import { pageMetadata, webPageLd } from "@/lib/seo";

const TITLE = "Liquor Prices in India: Whisky, Beer, Wine, Vodka, Rum, Brandy";
const DESCRIPTION = "Explore liquor prices in India by category: whisky, beer, wine, vodka, rum and brandy. Brand-wise price ranges and state-wise prices by bottle size.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/prices" });

export default async function PricesPage() {
  const [summaries, about, faqs] = await Promise.all([getCategorySummaries(), getPageContent("prices:about"), getFaqs("prices")]);
  const counts = new Map(summaries.map((c) => [c.slug, c.brandCount]));
  return (
    <div>
      <Breadcrumbs items={[{ name: "Liquor Prices", href: "/prices" }]} />
      <section className="py-5 text-center">
        <h1 className="text-[clamp(27px,4vw,40px)] font-extrabold leading-tight text-navy">Liquor Prices in India</h1>
        <p className="mx-auto mt-2 max-w-3xl text-muted">
          Explore liquor prices by category. Find brand and bottle-size details for whisky, beer, wine, vodka, rum and brandy.
          Prices and availability vary by state.
        </p>
      </section>

      <section className="border-b border-line pb-7">
        <h2 className="text-2xl font-bold">Explore Liquor Price Categories</h2>
        <p className="mt-1 mb-4 text-muted">Choose a category to browse brands and their prices.</p>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/prices/${c.slug}`} className="card card-hover block !p-4 sm:!p-5">
              <div className="mb-2 flex items-center gap-3">
                <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-tile text-2xl">
                  {c.emoji}
                </span>
                <h3 className="text-lg font-bold sm:text-xl">{c.name} Prices</h3>
              </div>
              <p className="mb-3 text-sm text-muted">
                {c.blurb} <span className="whitespace-nowrap">{counts.get(c.slug) ?? 0} brands.</span>
              </p>
              <span className="text-sm font-bold text-link">Explore {c.name} ›</span>
            </Link>
          ))}
        </div>
      </section>

      {about && (
        // Written in the admin (Pages) or the Excel "Page content" sheet; hidden until then.
        <section className="card mt-6">
          <h2 className="text-xl font-bold">About Liquor Price Information</h2>
          <RichText html={about.html} className="mt-2" />
        </section>
      )}

      <Faq items={faqs} />

      <JsonLd
        data={webPageLd({
          type: "CollectionPage",
          path: "/prices",
          name: TITLE,
          description: DESCRIPTION,
          hasBreadcrumb: true,
          mainEntity: {
            "@type": "ItemList",
            name: "Liquor price categories",
            numberOfItems: CATEGORIES.length,
            itemListElement: CATEGORIES.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: `${c.name} prices in India`, url: `${SITE_URL}/prices/${c.slug}` })),
          },
        })}
      />
    </div>
  );
}
