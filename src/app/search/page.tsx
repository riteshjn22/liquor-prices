import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandRows } from "@/components/Blocks";
import { searchBrands } from "@/lib/data";

export const metadata: Metadata = {
  title: "Search brands",
  // Search result pages are thin/duplicate content: keep them out of the index, but let bots follow links.
  robots: { index: false, follow: true },
};

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 80) ?? "";
  if (!query) return <p className="mt-4 text-muted">Type a brand name, for example “Old Monk” or “Kingfisher”.</p>;
  const results = await searchBrands(query);
  return (
    <div className="mt-4">
      <p className="mb-4 text-muted">
        {results.length === 0 ? "No brands found" : `${results.length}${results.length === 48 ? "+" : ""} brands found`} for <b className="text-ink">“{query}”</b>
      </p>
      {results.length > 0 && <BrandRows brands={results} />}
    </div>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div>
      <h1 className="text-3xl font-extrabold text-navy">Search liquor prices</h1>
      <form action="/search" method="get" role="search" className="mt-4 flex max-w-xl">
        <label htmlFor="search-page-q" className="sr-only">
          Search brands
        </label>
        <input id="search-page-q" name="q" type="search" placeholder="Search a brand" className="w-full rounded-l-full border border-line bg-white px-4 py-2.5 outline-none focus:border-link" />
        <button className="rounded-r-full bg-navy px-5 font-bold text-white">Search</button>
      </form>
      <Suspense fallback={<p className="mt-4 text-muted">Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
