import { BrandCards, CategoryTiles, ChangesList, SectionTitle } from "@/components/Blocks";
import { getCategorySummaries, getPopularBrands, getRecentChanges, getSiteStats } from "@/lib/data";

export default async function HomePage() {
  const [categories, popular, changes, stats] = await Promise.all([getCategorySummaries(), getPopularBrands(12), getRecentChanges(6), getSiteStats()]);

  return (
    <div>
      <section className="text-center">
        <h1 className="text-[clamp(26px,3.4vw,38px)] font-extrabold tracking-tight text-navy">India&apos;s Liquor Price Directory</h1>
        <p className="mx-auto mt-2 max-w-2xl text-[17px] text-muted">
          Brand-wise prices for whisky, beer, wine, vodka, rum and brandy, with official state excise MRPs where available.
        </p>
        <form action="/search" method="get" role="search" className="mx-auto mt-5 flex h-14 max-w-2xl items-center gap-3 rounded-full border border-[#cbd2dc] bg-[#f1f2f5] px-5">
          <span aria-hidden className="text-xl text-muted">
            ⌕
          </span>
          <label htmlFor="home-search" className="sr-only">
            Search brands
          </label>
          <input id="home-search" name="q" type="search" placeholder="Search a brand, e.g. Kingfisher, Old Monk, Sula" className="w-full bg-transparent text-[17px] outline-none" />
          <button className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white">Search</button>
        </form>
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
    </div>
  );
}
