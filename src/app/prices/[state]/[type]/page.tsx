import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageSkeleton } from "@/components/PageSkeleton";
import { BrandCards, Faq, SourceNote } from "@/components/Blocks";
import { BrandTable, type BrandRow } from "@/components/BrandTable";
import { JsonLd } from "@/components/JsonLd";
import { getBrandsByType, getCheapest, getPopularBrands, getStateStats, getType, getTypes } from "@/lib/data";
import { getStateConfig, SITE_URL, STATES } from "@/lib/config";
import { formatINR, fyLabel } from "@/lib/format";

export const ensureStatic = "navigation";

const PLACEHOLDER = "__none__";

// Parent params only cascade from layouts, so generate every segment here.
// ensureStatic = "navigation" needs at least one complete set, even on an empty database.
export async function generateStaticParams() {
  const out: { state: string; type: string }[] = [];
  for (const s of STATES) {
    for (const t of await getTypes(s.slug)) out.push({ state: s.slug, type: t.slug });
  }
  return out.length ? out : [{ state: STATES[0].slug, type: PLACEHOLDER }];
}

export async function generateMetadata({ params }: PageProps<"/prices/[state]/[type]">): Promise<Metadata> {
  const { state, type } = await params;
  const cfg = getStateConfig(state);
  const t = cfg ? await getType(state, type) : null;
  if (!cfg || !t) return {};
  const stats = await getStateStats(state);
  const fy = fyLabel(stats.latestFy);
  return {
    title: `${t.name} Price List in ${cfg.name} ${fy}: ${t.brandCount} Brands`,
    description: `Latest MRP of ${t.brandCount} ${t.name.toLowerCase()} brands in ${cfg.name} for FY ${fy}. Prices from ${formatINR(t.minRef)} to ${formatINR(t.maxRef)}, with sizes, tax breakdown and price history.`,
    alternates: { canonical: `/prices/${state}/${type}` },
  };
}

export default function TypePage({ params }: PageProps<"/prices/[state]/[type]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TypeContent params={params} />
    </Suspense>
  );
}

async function TypeContent({ params }: Pick<PageProps<"/prices/[state]/[type]">, "params">) {
  const { state, type } = await params;
  const cfg = getStateConfig(state);
  if (!cfg || type === PLACEHOLDER) notFound();
  const t = await getType(state, type);
  if (!t) notFound();

  const [brands, cheapest, popular, stats] = await Promise.all([
    getBrandsByType(state, type),
    getCheapest(state, type, 10),
    getPopularBrands(state, 8, type),
    getStateStats(state),
  ]);
  const fy = fyLabel(stats.latestFy);
  const basePath = `/prices/${state}/${type}`;
  const current = brands.filter((b) => b.isCurrent);
  const priciest = [...current].sort((a, b) => b.refMrp - a.refMrp)[0];
  const lower = t.name.toLowerCase();

  const rows: BrandRow[] = brands.map((b) => ({
    slug: b.slug,
    name: b.name,
    refMrp: b.refMrp,
    refSize: b.refSize,
    minMrp: b.minMrp,
    maxMrp: b.maxMrp,
    sizes: b.sizeLabels,
    isCurrent: b.isCurrent,
    fy: fyLabel(b.latestFy),
  }));

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: "Prices", href: "/prices" },
          { name: cfg.name, href: `/prices/${state}` },
          { name: t.name, href: basePath },
        ]}
      />
      <h1 className="mt-4 text-3xl font-bold text-slate-900">
        {t.name} Price List in {cfg.name} {fy}
      </h1>
      <p className="mt-2 max-w-3xl text-slate-700">
        Official MRP of {t.brandCount} {lower} brands in {cfg.name}. Prices range from {formatINR(t.minRef)} to{" "}
        {formatINR(t.maxRef)} depending on the brand. The price shown is for the 750 ml bottle where one is
        sold; open a brand to see every size and the tax breakdown.
      </p>

      {cheapest.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-slate-900">Cheapest {lower} in {cfg.name} (750 ml)</h2>
          <ol className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            {cheapest.map((b, i) => (
              <li key={b.key} className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
                <Link href={`${basePath}/${b.slug}`} className="text-slate-800 hover:text-amber-700 hover:underline">
                  {i + 1}. {b.name}
                </Link>
                <span className="font-semibold">{formatINR(b.refMrp)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {popular.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900">Popular {lower} brands</h2>
          <div className="mt-4">
            <BrandCards brands={popular} />
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold text-slate-900">All {lower} prices in {cfg.name}</h2>
        <BrandTable basePath={basePath} rows={rows} />
      </section>

      <Faq
        items={[
          ...(cheapest[0]
            ? [{ q: `Which is the cheapest ${lower} in ${cfg.name}?`, a: `${cheapest[0].name} has the lowest MRP for a 750 ml bottle at ${formatINR(cheapest[0].refMrp)} (FY ${fy}).` }]
            : []),
          ...(priciest
            ? [{ q: `Which is the most expensive ${lower} in ${cfg.name}?`, a: `${priciest.name} is the most expensive at ${formatINR(priciest.refMrp)} for ${priciest.refSize}.` }]
            : []),
          {
            q: `How many ${lower} brands are sold in ${cfg.name}?`,
            a: `${current.length} ${lower} brands have a price for FY ${fy}, and ${t.brandCount} appear on the list overall.`,
          },
        ]}
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${t.name} prices in ${cfg.name}`,
          numberOfItems: current.length,
          itemListElement: current.slice(0, 50).map((b, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_URL}${basePath}/${b.slug}`,
            name: b.name,
          })),
        }}
      />
      <SourceNote sourceName={cfg.sourceName} sourceUrl={cfg.sourceUrl} lastSyncedAt={stats.lastSyncedAt} />
    </div>
  );
}
