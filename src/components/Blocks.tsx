import Link from "next/link";
import { formatRange } from "@/lib/brand-match";
import { getCategory } from "@/lib/categories";
import { formatDate, formatINR } from "@/lib/format";
import { stateName } from "@/lib/states";
import type { BrandPriceChange, BrandSummary, CategorySummary } from "@/lib/types";
import { BrandImage } from "./BrandImage";
import { JsonLd } from "./JsonLd";

export function brandHref(b: { key: string }) {
  return `/prices/${b.key}`;
}

/**
 * Headline price for a brand: low-high from its state-wise price table (official prices and
 * prices added in Excel); your approximate Excel range when the table is empty; else "pending".
 */
export function priceLabel(b: BrandSummary): { main: string; small: string; pending: boolean } {
  if (b.tableMin !== null) return { main: formatRange(b.tableMin, b.tableMax), small: "Low to high, all sizes", pending: false };
  if (b.priceText) return { main: b.priceText, small: b.priceNote || "Approx. price range", pending: false };
  return { main: "Price range pending", small: b.priceNote || "Verify state-wise data", pending: true };
}

export function PriceTag({ b, align = "right" }: { b: BrandSummary; align?: "left" | "right" }) {
  const cls = align === "right" ? "text-right" : "text-left";
  const p = priceLabel(b);
  return (
    <div className={`${cls} ${p.pending ? "text-sm font-semibold text-[#697586]" : "font-extrabold text-navy"}`}>
      {p.main}
      <small className="block text-[11px] font-medium text-muted">{p.small}</small>
    </div>
  );
}

function coverage(b: BrandSummary): string {
  const parts: string[] = [];
  if (b.productCount) parts.push(`${b.productCount} variant${b.productCount === 1 ? "" : "s"} with official MRP`);
  if (b.stateCount) parts.push(`prices for ${b.stateCount} state${b.stateCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** A–Z list rows, as on a category page. */
export function BrandRows({ brands }: { brands: BrandSummary[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      {brands.map((b) => (
        <Link
          key={b.key}
          href={brandHref(b)}
          id={`brand-${b.slug}`}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0 hover:bg-[#fffbeb] sm:px-5"
        >
          <div className="min-w-0">
            <div className="font-bold text-ink">{b.name}</div>
            <div className="mt-0.5 text-[13px] text-muted">{coverage(b) || `${getCategory(b.category)?.name ?? ""} · state prices pending`}</div>
          </div>
          <PriceTag b={b} />
        </Link>
      ))}
    </div>
  );
}

/** Compact cards with image, used for popular / related brands. */
export function BrandCards({ brands }: { brands: BrandSummary[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {brands.map((b) => (
        <li key={b.key}>
          <Link href={brandHref(b)} className="card card-hover flex h-full items-center gap-3 !p-3">
            <BrandImage image={b.image} name={b.name} typeSlug={b.category} size={56} />
            <span className="min-w-0">
              <span className="line-clamp-2 text-sm font-bold text-ink">{b.name}</span>
              <span className="mt-0.5 block text-sm text-muted">
                {priceLabel(b).pending ? "Price pending" : priceLabel(b).main}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CategoryTiles({ categories }: { categories: CategorySummary[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
      {categories.map((c) => (
        <li key={c.slug}>
          <Link href={`/prices/${c.slug}`} className="card-hover block rounded-2xl border border-line bg-white px-2 py-3 text-center">
            <span className="block text-[32px] leading-tight" aria-hidden>
              {c.emoji}
            </span>
            <strong className="block text-[15px]">{c.name}</strong>
            <span className="text-xs text-muted">{c.brandCount} brands</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ChangesList({ changes }: { changes: BrandPriceChange[] }) {
  if (!changes.length) return <p className="text-sm text-muted">No price changes recorded yet. Changes appear here after the excise price list is synced.</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {changes.map((c) => {
        const up = c.newMrp > c.oldMrp;
        return (
          <li key={`${c.productKey}-${c.sizeKey}-${c.detectedAt}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
            <Link href={`/prices/${c.brandKey}`} className="font-semibold text-ink hover:text-link hover:underline">
              {c.brandName} <span className="font-normal text-muted">{c.variant} · {c.sizeLabel} · {stateName(c.state)}</span>
            </Link>
            <span className="whitespace-nowrap">
              <span className="text-slate-400 line-through">{formatINR(c.oldMrp)}</span>{" "}
              <span className={up ? "font-bold text-red-700" : "font-bold text-green-700"}>
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

export function Faq({ items, title = "Frequently Asked Questions" }: { items: FaqItem[]; title?: string }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-2xl font-bold">{title}</h2>
      {items.map((f) => (
        <details key={f.q} className="faq-item">
          <summary>{f.q}</summary>
          <p className="mt-3 text-muted">{f.a}</p>
        </details>
      ))}
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

export function SectionTitle({ title, href, linkText }: { title: string; href?: string; linkText?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[23px] font-bold tracking-tight">{title}</h2>
      {href && (
        <Link href={href} className="whitespace-nowrap text-sm font-bold text-link hover:underline">
          {linkText} ›
        </Link>
      )}
    </div>
  );
}
