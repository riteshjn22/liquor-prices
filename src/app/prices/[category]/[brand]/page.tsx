import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrandCards, ChangesList, Faq, type FaqItem } from "@/components/Blocks";
import { BrandImage } from "@/components/BrandImage";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { PageSkeleton } from "@/components/PageSkeleton";
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

/** State × size summary: one row per state, one column per common bottle size. */
type Matrix = { sizes: { ml: number; label: string }[]; rows: { slug: string; name: string; official: boolean; cells: (string | null)[] }[]; truncated: boolean; multiVariant: boolean };

const MAX_SIZE_COLUMNS = 5;

function buildMatrix(sections: StateSection[]): Matrix {
  const perState = sections.map((s) => {
    const bySize = new Map<number, number[]>();
    const add = (ml: number | null | undefined, mrp: number) => {
      if (!ml) return;
      bySize.set(ml, [...(bySize.get(ml) ?? []), mrp]);
    };
    for (const r of s.official) add(r.ml, r.mrp);
    for (const m of s.manual) add(m.ml, m.mrp);
    return { s, bySize };
  });
  // Pick the sizes listed in the most states, then show them small to large.
  // Miniatures (60/90 ml) are left out when at least 3 regular sizes exist, so 180/375/750 fit on a phone.
  const stateCount = new Map<number, number>();
  for (const { bySize } of perState) for (const ml of bySize.keys()) stateCount.set(ml, (stateCount.get(ml) ?? 0) + 1);
  const all = [...stateCount.keys()];
  const regular = all.filter((ml) => ml >= 180);
  const pool = regular.length >= 3 ? regular : all;
  const STANDARD = [750, 375, 180, 1000, 650, 500, 330];
  const rank = (ml: number) => (STANDARD.includes(ml) ? STANDARD.indexOf(ml) : STANDARD.length + ml);
  const chosen = [...pool].sort((a, b) => stateCount.get(b)! - stateCount.get(a)! || rank(a) - rank(b)).slice(0, MAX_SIZE_COLUMNS).sort((a, b) => a - b);
  const multiVariant = perState.some(({ bySize }) => chosen.some((ml) => new Set(bySize.get(ml) ?? []).size > 1));
  return {
    sizes: chosen.map((ml) => ({ ml, label: sizeLabel(ml) })),
    rows: perState
      .filter(({ bySize }) => chosen.some((ml) => bySize.has(ml)))
      .map(({ s, bySize }) => ({
        slug: s.slug,
        name: s.name,
        official: s.official.length > 0,
        cells: chosen.map((ml) => {
          const p = bySize.get(ml);
          return p ? formatRange(Math.min(...p), Math.max(...p)) : null;
        }),
      })),
    truncated: all.length > chosen.length,
    multiVariant,
  };
}

function StateMatrix({ brandName, m }: { brandName: string; m: Matrix }) {
  return (
    <section className="mt-8">
      <h2 className="text-2xl font-bold">{brandName} Price State-wise</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="price-table [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-3 sm:[&_th]:px-3">
          <thead>
            <tr>
              <th className="sticky left-0 bg-tile">State</th>
              {m.sizes.map((s) => (
                <th key={s.ml} className="whitespace-nowrap text-right">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.rows.map((r) => (
              <tr key={r.slug}>
                <td className="sticky left-0 bg-white">
                  <a href={`#state-${r.slug}`} className="font-semibold text-link hover:underline">
                    {r.name}
                  </a>
                  {r.official && (
                    <span className="mt-0.5 block w-fit rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-green-700 sm:ml-1.5 sm:mt-0 sm:inline">Official</span>
                  )}
                </td>
                {r.cells.map((c, i) => (
                  <td key={m.sizes[i].ml} className="whitespace-nowrap text-right font-bold">
                    {c ?? <span className="font-normal text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        {m.multiVariant && "Where several variants share a size, the range covers all of them. "}
        {m.truncated && "Showing the most common sizes. "}
        Tap a state for every variant and size.
      </p>
    </section>
  );
}

type StateSection = { slug: string; name: string; official: OfficialRow[]; older: DisplayProduct[]; manual: StatePrice[]; source?: { name: string; url: string } };

function buildSections(page: BrandPage): StateSection[] {
  const map = new Map<string, StateSection>();
  const get = (slug: string) => {
    let s = map.get(slug);
    if (!s) {
      const cfg = getStateConfig(slug);
      s = { slug, name: stateName(slug), official: [], older: [], manual: [], source: cfg ? { name: cfg.sourceName, url: cfg.sourceUrl } : undefined };
      map.set(slug, s);
    }
    return s;
  };
  for (const state of new Set(page.products.map((p) => p.state))) {
    const ps = page.products.filter((p) => p.state === state);
    const s = get(state);
    s.official = officialRows(ps);
    s.older = ps.filter((p) => !p.isCurrent);
  }
  for (const sp of page.statePrices) get(sp.state).manual.push(sp);
  // Official sources first, then other states A-Z.
  return [...map.values()]
    .filter((s) => s.official.length || s.manual.length || s.older.length)
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

function OfficialTable({ s }: { s: StateSection }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="price-table">
        <thead>
          <tr>
            <th>Variant</th>
            <th>Size</th>
            <th className="text-right">MRP</th>
          </tr>
        </thead>
        <tbody>
          {s.official.map((r, i) => (
            <tr key={`${r.productKey}-${r.size}-${i}`}>
              <td className="font-medium">{i > 0 && s.official[i - 1].variant === r.variant ? <span className="text-slate-300">〃</span> : r.variant}</td>
              <td className="whitespace-nowrap">{r.size}</td>
              <td className="whitespace-nowrap text-right font-bold">{formatINR(r.mrp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManualTable({ rows }: { rows: StatePrice[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="price-table">
        <thead>
          <tr>
            <th>Variant</th>
            <th>Size</th>
            <th className="text-right">MRP</th>
            <th className="hidden sm:table-cell">Note</th>
          </tr>
        </thead>
        <tbody>
          {[...rows]
            .sort((a, b) => a.variant.localeCompare(b.variant) || (a.ml ?? 0) - (b.ml ?? 0))
            .map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.variant || "—"}</td>
                <td className="whitespace-nowrap">{r.size || "—"}</td>
                <td className="whitespace-nowrap text-right font-bold">{formatINR(r.mrp)}</td>
                <td className="hidden text-muted sm:table-cell">{r.note}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
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

  const matrix = buildMatrix(sections);
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
            {listedRange && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">Listed state prices</div>
                <div className="text-2xl font-extrabold text-ink">{listedRange}</div>
              </div>
            )}
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

      {matrix.rows.length > 0 && <StateMatrix brandName={brand.name} m={matrix} />}

      <section className="mt-8">
        <h2 className="text-2xl font-bold">{brand.name} Price List by State</h2>
        {sections.length === 0 ? (
          <div className="note mt-3">
            <strong>State prices pending:</strong> {brand.name} is not on the official excise lists we track yet, and no state prices have been added. The range above is approximate.
          </div>
        ) : (
          <>
            {sections.length > 1 && (
              <nav aria-label="States" className="mt-3 flex flex-wrap gap-2">
                {sections.map((s) => (
                  <a key={s.slug} href={`#state-${s.slug}`} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-bold text-link hover:border-link">
                    {s.name}
                  </a>
                ))}
              </nav>
            )}
            <div className="mt-4 space-y-8">
              {sections.map((s) => (
                <section key={s.slug} id={`state-${s.slug}`} className="scroll-mt-4">
                  <h3 className="text-xl font-bold">
                    {brand.name} price in {s.name}
                  </h3>
                  {s.official.length > 0 && (
                    <>
                      <p className="mt-1 mb-3 text-sm text-muted">
                        Official MRP for FY {fyLabel(s.official[0].fy)} from the{" "}
                        {s.source ? (
                          <a href={s.source.url} rel="nofollow noopener" target="_blank" className="text-link underline">
                            {s.source.name}
                          </a>
                        ) : (
                          "state excise department"
                        )}
                        {stats.lastSyncedAt ? `, checked ${formatDate(stats.lastSyncedAt)}` : ""}.
                      </p>
                      <OfficialTable s={s} />
                    </>
                  )}
                  {s.manual.length > 0 && (
                    <>
                      <p className={`${s.official.length ? "mt-4" : "mt-1"} mb-3 text-sm text-muted`}>
                        {s.official.length ? "More prices added by our team." : `Prices added by our team for ${s.name}.`} Check the MRP printed on the bottle.
                      </p>
                      <ManualTable rows={s.manual} />
                    </>
                  )}
                  {s.older.length > 0 && (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-link">
                        {s.older.length} variant{s.older.length === 1 ? "" : "s"} no longer on the current {s.name} list
                      </summary>
                      <ul className="mt-2 list-disc pl-5 text-muted">
                        {s.older.map((p) => (
                          <li key={p.key}>
                            {p.variant}: last listed FY {fyLabel(p.latestFy)} ({p.sizes.map((x) => `${x.label} ${formatINR(x.mrp)}`).join(", ")})
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </section>

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
