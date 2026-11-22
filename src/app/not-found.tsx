import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-extrabold text-navy">Page not found</h1>
      <p className="mt-3 text-muted">This brand or page isn’t on our price list. Try searching for it instead.</p>
      <form action="/search" method="get" className="mx-auto mt-6 flex max-w-md">
        <input name="q" type="search" aria-label="Search brands" placeholder="Search a brand" className="w-full rounded-l-full border border-line bg-white px-4 py-2" />
        <button className="rounded-r-full bg-navy px-5 font-bold text-white">Search</button>
      </form>
      <Link href="/prices" className="mt-6 inline-block font-bold text-link hover:underline">
        Browse all liquor prices ›
      </Link>
    </div>
  );
}
