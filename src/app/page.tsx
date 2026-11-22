import { BrandCards, CategoryTiles, ChangesList, Faq, SectionTitle } from "@/components/Blocks";
import { getCategorySummaries, getFaqs, getPopularBrands, getRecentChanges, getSiteStats } from "@/lib/data";

export default async function HomePage() {
  const [categories, popular, changes, stats, faqs] = await Promise.all([getCategorySummaries(), getPopularBrands(12), getRecentChanges(6), getSiteStats(), getFaqs("home")]);

  return (
    <div>
      <section className="text-center">
        <h1 className="text-[clamp(26px,3.4vw,38px)] font-extrabold tracking-tight text-navy">India&apos;s Liquor Price Directory</h1>
        <p className="mx-auto mt-2 max-w-2xl text-[17px] text-muted">
          Brand-wise prices for whisky, beer, wine, vodka, rum and brandy, with official state excise MRPs where available.
        </p>
        {stats.brandCount > 0 && <p className="mt-3 text-sm text-muted">{stats.brandCount.toLocaleString("en-IN")} brands listed</p>}
      </section>

      <section className="mt-8 border-b border-line pb-7">
        <SectionTitle title="Explore Liquor Categories" href="/prices" linkText="View all categories" />
        <CategoryTiles categories={categories} />
      </section>

      {popular.length > 0 && (
        <section className="mt-7 border-b border-line pb-7">
          <SectionTitle title="Popular Brands" />
          <BrandCards brands={popular} />
        </section>
      )}

      <section className="mt-7">
        <SectionTitle title="Latest Price Updates" />
        <p className="mb-3 text-muted">Recent changes in official excise price lists for brands on this site.</p>
        <div className="card !py-2">
          <ChangesList changes={changes} />
        </div>
      </section>

      <Faq items={faqs} />
    </div>
  );
}
