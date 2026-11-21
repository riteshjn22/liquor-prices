import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { STATES } from "@/lib/config";

export const metadata: Metadata = {
  title: "Liquor Price List by State",
  description: "Official liquor MRP price lists by state: whisky, beer, rum, vodka, wine and more.",
  alternates: { canonical: "/prices" },
};

export default function PricesIndexPage() {
  return (
    <div>
      <Breadcrumbs items={[{ name: "Prices", href: "/prices" }]} />
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Liquor price list by state</h1>
      <p className="mt-2 text-slate-600">Pick a state to see the official MRP of every brand sold there.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {STATES.map((s) => (
          <li key={s.slug}>
            <Link href={`/prices/${s.slug}`} className="card block font-semibold text-slate-900 hover:border-amber-400">
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
