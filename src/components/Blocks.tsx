import Link from "next/link";
import type { BrandSummary, PriceChange, TypeSummary } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { BrandImage } from "./BrandImage";
import { JsonLd } from "./JsonLd";

export function brandHref(b: { state: string; typeSlug: string; slug: string }) {
  return `/prices/${b.state}/${b.typeSlug}/${b.slug}`;
}

export function BrandCards({ brands }: { brands: BrandSummary[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {brands.map((b) => (
        <li key={b.key}>
          <Link href={brandHref(b)} className="card flex h-full items-center gap-3 !p-3 transition hover:border-amber-400">
            <BrandImage image={b.image} name={b.name} typeSlug={b.typeSlug} size={56} />
            <span className="min-w-0">
              <span className="line-clamp-2 text-sm font-medium text-slate-900">{b.name}</span>
              <span className="mt-0.5 block text-sm text-slate-600">
                {formatINR(b.refMrp)} <span className="text-slate-400">· {b.refSize}</span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TypeGrid({ state, types }: { state: string; types: TypeSummary[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {types.map((t) => (
        <li key={t.slug}>
          <Link href={`/prices/${state}/${t.slug}`} className="card block h-full !p-4 transition hover:border-amber-400">
            <span className="block font-semibold text-slate-900">{t.name}</span>
            <span className="mt-1 block text-sm text-slate-600">{t.brandCount} brands</span>
            <span className="mt-1 block text-xs text-slate-500">
              {formatINR(t.minRef)} – {formatINR(t.maxRef)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ChangesList({ changes }: { changes: PriceChange[] }) {
  if (!changes.length) return <p className="text-sm text-slate-500">No price changes recorded yet. Changes appear here after each daily sync.</p>;
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {changes.map((c) => {
        const up = c.newMrp > c.oldMrp;
        return (
          <li key={`${c.brandKey}-${c.sizeKey}-${c.detectedAt}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
            <Link href={`/prices/${c.state}/${c.typeSlug}/${c.brandSlug}`} className="font-medium text-slate-800 hover:text-amber-700 hover:underline">
              {c.brandName} <span className="font-normal text-slate-500">{c.sizeLabel}</span>
            </Link>
            <span className="whitespace-nowrap">
              <span className="text-slate-400 line-through">{formatINR(c.oldMrp)}</span>{" "}
              <span className={up ? "font-semibold text-red-700" : "font-semibold text-green-700"}>
                {formatINR(c.newMrp)} {up ? "▲" : "▼"}
              </span>
              <span className="ml-2 text-xs text-slate-400">{formatDate(c.detectedAt)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export type FaqItem = { q: string; a: string };

export function Faq({ items }: { items: FaqItem[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-slate-900">Frequently asked questions</h2>
      <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {items.map((f) => (
          <details key={f.q} className="group px-5 py-4" open>
            <summary className="cursor-pointer list-none font-medium text-slate-900">{f.q}</summary>
            <p className="mt-2 text-slate-700">{f.a}</p>
          </details>
        ))}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
    </section>
  );
}

export function SourceNote({ sourceName, sourceUrl, lastSyncedAt }: { sourceName: string; sourceUrl: string; lastSyncedAt?: string | null }) {
  return (
    <p className="mt-8 text-xs text-slate-500">
      Source:{" "}
      <a href={sourceUrl} rel="nofollow noopener" target="_blank" className="underline hover:text-amber-700">
        {sourceName}
      </a>
      {lastSyncedAt ? <> · Last checked {formatDate(lastSyncedAt)}</> : null}. MRP is the maximum retail price; shops may
      not charge more.
    </p>
  );
}
