import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandCards } from "@/components/Blocks";
import { searchBrands } from "@/lib/data";

export const metadata: Metadata = {
  title: "Search brands",
  // Search result pages are thin/duplicate content: keep them out of the index, but let bots follow links.
  robots: { index: false, follow: true },
};

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 80) ?? "";
  if (!query) return <p className="mt-4 text-slate-600">Type a brand name above, for example “Old Monk” or “Kingfisher”.</p>;
  const results = await searchBrands(query);
  return (
    <div className="mt-4">
      <p className="mb-4 text-slate-600">
        {results.length === 0 ? "No brands found" : `${results.length}${results.length === 60 ? "+" : ""} brands found`} for{" "}
        <b>“{query}”</b>
      </p>
      <BrandCards brands={results} />
    </div>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Search liquor prices</h1>
      <Suspense fallback={<p className="mt-4 text-slate-500">Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
