import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-600">This brand or page isn’t on our price list. Try searching for it instead.</p>
      <form action="/search" method="get" className="mx-auto mt-6 flex max-w-md">
        <input name="q" type="search" aria-label="Search brands" placeholder="Search a brand" className="w-full rounded-l-md border border-slate-300 px-3 py-2" />
        <button className="rounded-r-md bg-slate-900 px-4 text-white">Search</button>
      </form>
      <Link href="/" className="mt-6 inline-block text-amber-700 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
