import Link from "next/link";
import { BrandCards, ChangesList, TypeGrid } from "@/components/Blocks";
import { getPopularBrands, getRecentChanges, getStateStats, getTypes } from "@/lib/data";
import { SITE_NAME, STATES } from "@/lib/config";
import { fyLabel } from "@/lib/format";

export default async function HomePage() {
  const primary = STATES[0];
  const [stats, types, popular, changes] = await Promise.all([
    getStateStats(primary.slug),
    getTypes(primary.slug),
    getPopularBrands(primary.slug, 12),
    getRecentChanges(primary.slug, 8),
  ]);

  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-slate-900 px-6 py-10 text-white sm:px-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Liquor prices in India, straight from the excise list</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          {SITE_NAME} shows the official MRP of every whisky, beer, rum, vodka, gin and wine brand, with the full tax
          breakdown and price history. Data is synced daily from state excise departments.
        </p>
        <form action="/search" method="get" className="mt-6 flex max-w-xl">
          <input
            name="q"
            type="search"
            aria-label="Search brands"
            placeholder="Search a brand, e.g. Royal Stag, Kingfisher..."
            className="w-full rounded-l-lg bg-white px-4 py-3 text-slate-900 outline-none"
          />
          <button className="rounded-r-lg bg-amber-500 px-5 font-semibold text-slate-900 hover:bg-amber-400">Search</button>
        </form>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-slate-900">Choose a state</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {STATES.map((s) => (
            <li key={s.slug}>
              <Link href={`/prices/${s.slug}`} className="card block transition hover:border-amber-400">
                <span className="text-lg font-semibold text-slate-900">{s.name} liquor price list</span>
                {s.slug === primary.slug && stats.brandCount > 0 && (
                  <span className="mt-1 block text-sm text-slate-600">
                    {stats.brandCount.toLocaleString("en-IN")} brands · FY {fyLabel(stats.latestFy)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {types.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-slate-900">{primary.name} prices by type</h2>
          <div className="mt-4">
            <TypeGrid state={primary.slug} types={types} />
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-slate-900">Popular brands in {primary.name}</h2>
          <div className="mt-4">
            <BrandCards brands={popular} />
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="text-xl font-bold text-slate-900">Latest price changes in {primary.name}</h2>
        <div className="mt-3">
          <ChangesList changes={changes} />
        </div>
      </section>
    </div>
  );
}
