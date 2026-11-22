import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Faq } from "@/components/Blocks";
import { CATEGORIES } from "@/lib/categories";
import { getCategorySummaries } from "@/lib/data";

export const metadata: Metadata = {
  title: "Liquor Prices in India: Whisky, Beer, Wine, Vodka, Rum, Brandy",
  description: "Explore liquor prices in India by category: whisky, beer, wine, vodka, rum and brandy. Brand-wise price ranges and official state MRPs by bottle size.",
  alternates: { canonical: "/prices" },
};

export default async function PricesPage() {
  const counts = new Map((await getCategorySummaries()).map((c) => [c.slug, c.brandCount]));
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

      <section className="card mt-6">
        <h2 className="text-xl font-bold">About Liquor Price Information</h2>
        <p className="mt-2 text-muted">
          Liquor prices in India differ between states because of excise duties, taxes, pricing policies, availability and
          pack sizes. Each brand page lists official prices by state where we have them, with the source and date.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Category-wise", "Browse brands by type of drink."],
            ["Brand & pack size", "See every variant and bottle size we have a price for."],
            ["State & source", "Official excise MRPs are labelled with their state and date."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl bg-tile p-3.5">
              <strong className="block">{t}</strong>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <Faq
        items={[
          { q: "Why do liquor prices differ from state to state?", a: "Each state sets its own excise duty, taxes and pricing rules, so the same bottle can have a different MRP in different states." },
          { q: "Are liquor prices the same for every bottle size?", a: "No. Prices vary by pack size and variant. Each brand page lists prices per size." },
          { q: "Are the prices on this site official?", a: "Prices in the state tables marked as official come from state excise department price lists. Price ranges are indicative. Always check the MRP printed on the bottle." },
          { q: "How often are prices updated?", a: "Prices are updated when new information from state excise departments or other reliable sources is available." },
        ]}
      />
    </div>
  );
}
