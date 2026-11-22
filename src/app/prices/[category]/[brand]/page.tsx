import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrandCards, ChangesList, Faq, type FaqItem } from "@/components/Blocks";
import { BrandImage } from "@/components/BrandImage";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { PageSkeleton } from "@/components/PageSkeleton";
import { StateWiseTabs, type VariantTable } from "@/components/StateWiseTabs";
import { formatRange } from "@/lib/brand-match";
import { getCategory } from "@/lib/categories";
import { getStateConfig, SITE_URL } from "@/lib/config";
import { getAllBrandParams, getBrandChanges, getBrandPage, getRelatedBrands, getSiteStats, type BrandPage, type DisplayProduct } from "@/lib/data";
import { formatDate, formatINR, fyLabel } from "@/lib/format";
import { imageKitEnabled, imageKitUrl } from "@/lib/imagekit";
import { sizeLabel } from "@/lib/normalize";
import { stateName } from "@/lib/states";
import type { StatePrice } from "@/lib/types";

export const ensureStatic = "navigation";

const PLACEHOLDER = "__none__";

/** Every enabled brand is prerendered at build time (a few hundred pages). */
export async function generateStaticParams() {
  const params = await getAllBrandParams();
  return params.length ? params : [{ category: "whisky", brand: PLACEHOLDER }];
}

type Props = PageProps<"/prices/[category]/[brand]">;

async function load(params: Props["params"]): Promise<BrandPage | null> {
  const { category, brand } = await params;
  if (brand === PLACEHOLDER || !getCategory(category)) return null;
  return getBrandPage(category, brand);
}

type OfficialRow = { variant: string; size: string; ml: number; mrp: number; fy: string; productKey: string };

function officialRows(products: DisplayProduct[]): OfficialRow[] {
  const raw = products
    .filter((p) => p.isCurrent)
    .flatMap((p) =>
      p.sizes.filter((s) => s.isCurrent).map((s) => ({ variant: p.variant, size: s.label, ml: s.ml, pack: s.packageType, mrp: s.mrp, fy: s.fy, productKey: p.key })),
    );
  // There is no Pack column: merge glass/PET rows with the same price, and only
  // mention the pack when the same variant and size has different prices.
  const groups = new Map<string, typeof raw>();
  for (const r of raw) {
    const k = `${r.variant}|${r.ml}`;
    const list = groups.get(k) ?? [];
    if (!list.some((x) => x.mrp === r.mrp)) list.push(r);
    groups.set(k, list);
  }
  return [...groups.values()]
    .flatMap((list) => list.map(({ pack, ...r }) => ({ ...r, size: list.length > 1 ? `${r.size} · ${pack}` : r.size })))
    .sort((a, b) => a.variant.localeCompare(b.variant) || a.ml - b.ml || a.mrp - b.mrp);
}

/** One state × size table per variant (single prices, no ranges), shown as tabs. */

function buildVariantTables(sections: StateSection[], brandName: string): VariantTable[] {
  // variant -> state -> ml -> prices
  const byVariant = new Map<string, { label: string; states: Map<string, Map<number, number[]>>; official: Set<string> }>();
  const add = (variant: string, state: string, ml: number | null | undefined, mrp: number, isOfficial: boolean) => {
    if (!ml) return;
    const label = variant.trim() || brandName;
    const k = label.toLowerCase();
    const v = byVariant.get(k) ?? { label, states: new Map(), official: new Set<string>() };
    if (isOfficial) v.official.add(state);
    const sizes = v.states.get(state) ?? new Map<number, number[]>();
    sizes.set(ml, [...(sizes.get(ml) ?? []), mrp]);
    v.states.set(state, sizes);
    byVariant.set(k, v);
  };
  for (const s of sections) {
    for (const r of s.official) add(r.variant, s.slug, r.ml, r.mrp, true);
    for (const m of s.manual) add(m.variant, s.slug, m.ml, m.mrp, false);
  }

  const tables: (VariantTable & { score: number })[] = [];
  for (const { label, states, official } of byVariant.values()) {
    // Every size this variant is sold in, small to large (this table is the only price list on the page).
    const chosen = [...new Set([...states.values()].flatMap((sizes) => [...sizes.keys()]))].sort((a, b) => a - b);
    const rows = sections
      .filter((s) => states.get(s.slug) && chosen.some((ml) => states.get(s.slug)!.has(ml)))
      .map((s) => {
        const sizes = states.get(s.slug)!;
        return {
          slug: s.slug,
          name: s.name,
          official: official.has(s.slug),
          // One price per cell: if glass and PET differ, the lower one is shown.
          cells: chosen.map((ml) => (sizes.has(ml) ? Math.min(...sizes.get(ml)!) : null)),
        };
      });
    if (!rows.length) continue;
    tables.push({ variant: label, sizes: chosen.map((ml) => ({ ml, label: sizeLabel(ml) })), rows, score: states.size * 10 + chosen.length });
  }
  // Most widely listed variant first (more states, then more sizes), then A-Z.
  return tables
    .sort((a, b) => b.score - a.score || a.variant.localeCompare(b.variant))
    .map((t) => ({ variant: t.variant, sizes: t.sizes, rows: t.rows }));
}

type StateSection = { slug: string; name: string; official: OfficialRow[]; manual: StatePrice[]; source?: { name: string; url: string } };

function buildSections(page: BrandPage): StateSection[] {
  const map = new Map<string, StateSection>();
  const get = (slug: string) => {
    let s = map.get(slug);
    if (!s) {
      const cfg = getStateConfig(slug);
      s = { slug, name: stateName(slug), official: [], manual: [], source: cfg ? { name: cfg.sourceName, url: cfg.sourceUrl } : undefined };
      map.set(slug, s);
    }
    return s;
  };
  for (const state of new Set(page.products.map((p) => p.state))) {
    const ps = page.products.filter((p) => p.state === state);
    const s = get(state);
    s.official = officialRows(ps);
  }
  for (const sp of page.statePrices) get(sp.state).manual.push(sp);
  // Official sources first, then other states A-Z.
  return [...map.values()]
    // A state appears only if it has current official prices or prices you added.
    .filter((s) => s.official.length || s.manual.length)
    .sort((a, b) => Number(!!b.source) - Number(!!a.source) || a.name.localeCompare(b.name));
}

function allPrices(sections: StateSection[]): number[] {
  return sections.flatMap((s) => [...s.official.map((r) => r.mrp), ...s.manual.map((m) => m.mrp)]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load(params);
  if (!page) return {};
  const { brand } = page;
  const sections = buildSections(page);
  const range = brand.priceText || (allPrices(sections).length ? formatRange(Math.min(...allPrices(sections)), Math.max(...allPrices(sections))) : "");
  const title = brand.seoTitle || `${brand.name} Price in India${range ? `: ${range}` : ""} (All Sizes)`;
  const stateNames = sections.map((s) => s.name);
  const description =
    brand.seoDescription ||
    `${brand.name} price in India${brand.priceText ? `: approx. ${brand.priceText}` : ""}. ${
      stateNames.length ? `Prices by bottle size for ${stateNames.slice(0, 4).join(", ")}.` : "Variants and bottle sizes."
    } Official MRP where available.`;
  return {
    title,
    description,
    alternates: { canonical: `/prices/${brand.key}` },
    openGraph: {
      title,
      url: `/prices/${brand.key}`,
      images: brand.image && imageKitEnabled ? [{ url: imageKitUrl(brand.image, 1200, 630), width: 1200, height: 630 }] : undefined,
    },
  };
}

export default function BrandPageRoute({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BrandContent params={params} />
    </Suspense>
  );
}

async function BrandContent({ params }: Pick<Props, "params">) {
  const page = await load(params);
  if (!page) notFound();
  const { brand } = page;
  const cat = getCategory(brand.category)!;
  const sections = buildSections(page);
  const [related, changes, stats] = await Promise.all([
    getRelatedBrands(brand.category, brand.slug, brand.priceMin, 8),
    getBrandChanges(brand.key, 8),
    getSiteStats(),
  ]);

  const variantTables = buildVariantTables(sections, brand.name);
  const prices = allPrices(sections);
  const listedRange = prices.length ? formatRange(Math.min(...prices), Math.max(...prices)) : "";
  const variants = new Set([...sections.flatMap((s) => s.official.map((r) => r.variant)), ...page.statePrices.map((p) => p.variant).filter(Boolean)]);
  const lowerCat = cat.name.toLowerCase();

  const faq: FaqItem[] = [];
  faq.push({
    q: `What is the price of ${brand.name} in India?`,
    a: brand.priceText
      ? `${brand.name} costs approximately ${brand.priceText} in India${brand.priceNote ? ` (${brand.priceNote})` : ""}, depending on the variant, bottle size and state.${listedRange ? ` Listed state prices on this page range from ${listedRange}.` : ""}`
      : listedRange
        ? `Listed prices for ${brand.name} range from ${listedRange}, depending on the variant, bottle size and state.`
        : `We don't have a verified price for ${brand.name} yet. Prices are added as soon as reliable information is available.`,
  });
  for (const s of sections.slice(0, 4)) {
    const rows = s.official.length ? s.official : s.manual.map((m) => ({ variant: m.variant, size: m.size, mrp: m.mrp, ml: m.ml ?? 0 }));
    if (!rows.length) continue;
    const std = rows.filter((r) => r.ml === 750);
    const pick = (std.length ? std : rows).reduce((a, b) => (b.mrp < a.mrp ? b : a));
    faq.push({
      q: `What is the price of ${brand.name} in ${s.name}?`,
      a: `${s.official.length ? `As per the ${s.source?.name ?? "state excise list"}, ` : ""}${brand.name} ${pick.variant} ${pick.size} costs ${formatINR(pick.mrp)} in ${s.name}. ${
        rows.length > 1 ? `${rows.length} prices are listed for ${s.name}, from ${formatRange(Math.min(...rows.map((r) => r.mrp)), Math.max(...rows.map((r) => r.mrp)))}.` : ""
      }`.trim(),
    });
  }
  faq.push({ q: `Why is ${brand.name} priced differently in each state?`, a: "Each state sets its own excise duty, VAT and pricing rules, so the MRP of the same bottle varies from state to state." });

  return (
    <article>
      <Breadcrumbs
        items={[
          { name: "Liquor Prices", href: "/prices" },
          { name: cat.name, href: `/prices/${cat.slug}` },
          { name: brand.name, href: `/prices/${brand.key}` },
        ]}
      />

      <header className="card mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <BrandImage image={brand.image} name={brand.name} typeSlug={brand.category} size={140} priority className="shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(26px,3.6vw,38px)] font-extrabold leading-tight text-navy">{brand.name} Price in India</h1>
          <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Approx. price range</div>
              <div className="text-2xl font-extrabold text-navy">{brand.priceText || "Pending"}</div>
              {brand.priceNote && <div className="text-xs text-muted">{brand.priceNote}</div>}
            </div>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <li>
              <Link href={`/prices/${cat.slug}`} className="rounded-full bg-tile px-3 py-1 text-link hover:underline">
                {cat.emoji} {cat.name}
              </Link>
            </li>
            {variants.size > 0 && (
              <li className="rounded-full bg-tile px-3 py-1">
                {variants.size} variant{variants.size === 1 ? "" : "s"}
              </li>
            )}
            {sections.length > 0 && <li className="rounded-full bg-tile px-3 py-1">Prices for {sections.length} state{sections.length === 1 ? "" : "s"}</li>}
          </ul>
        </div>
      </header>

      {brand.description && (
        <section className="prose-lite mt-6 max-w-3xl">
          <h2 className="text-xl font-bold">About {brand.name}</h2>
          {brand.description
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
        </section>
      )}

      {variantTables.length > 0 ? (
        <StateWiseTabs brandName={brand.name} tables={variantTables}>
          {sections.some((s) => s.official.length) &&
            sections
              .filter((s) => s.official.length)
              .map((s) => (
                <span key={s.slug} className="block">
                  {s.name}: official MRP for FY {fyLabel(s.official[0].fy)} from the{" "}
                  {s.source ? (
                    <a href={s.source.url} rel="nofollow noopener" target="_blank" className="text-link underline">
                      {s.source.name}
                    </a>
                  ) : (
                    "state excise department"
                  )}
                  {stats.lastSyncedAt ? `, checked ${formatDate(stats.lastSyncedAt)}` : ""}.
                </span>
              ))}
          {sections.some((s) => s.manual.length) && (
            <span className="block">
              {sections.some((s) => s.official.length) ? "Other prices" : "Prices"} added by our team. Check the MRP printed on the bottle.
            </span>
          )}
        </StateWiseTabs>
      ) : (
        <section className="mt-8">
          <h2 className="text-2xl font-bold">{brand.name} Price State-wise</h2>
          <div className="note mt-3">
            <strong>State prices pending:</strong> {brand.name} is not on the official excise lists we track yet, and no state prices have been added. The range above is approximate.
          </div>
        </section>
      )}

      {changes.length > 0 && (
        <section className="card mt-8">
          <h2 className="text-lg font-bold">Recent price changes</h2>
          <div className="mt-2">
            <ChangesList changes={changes} />
          </div>
        </section>
      )}

      <Faq items={faq} />

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-2xl font-bold">Similar {lowerCat} brands</h2>
          <BrandCards brands={related} />
          <p className="mt-4 text-sm">
            <Link href={`/prices/${cat.slug}`} className="font-bold text-link hover:underline">
              See all {lowerCat} prices ›
            </Link>
          </p>
        </section>
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: brand.name,
          category: cat.name,
          url: `${SITE_URL}/prices/${brand.key}`,
          ...(brand.image && imageKitEnabled ? { image: imageKitUrl(brand.image, 800, 800) } : {}),
          ...(prices.length
            ? { offers: { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length } }
            : {}),
        }}
      />
    </article>
  );
}