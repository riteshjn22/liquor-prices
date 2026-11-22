import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-extrabold text-navy">Page not found</h1>
      <p className="mt-3 text-muted">This brand or page isn’t on our price list. Browse the categories to find it.</p>
      <Link href="/prices" className="mt-6 inline-block font-bold text-link hover:underline">
        Browse all liquor prices ›
      </Link>
    </div>
  );
}
