import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageSkeleton } from "@/components/PageSkeleton";
import { BrandImage } from "@/components/BrandImage";
import { BrandCards, ChangesList, Faq, SourceNote, type FaqItem } from "@/components/Blocks";
import { JsonLd } from "@/components/JsonLd";
import { getBrand, getBrandChanges, getPopularBrands, getRelatedBrands, getStateStats, getTypes } from "@/lib/data";
import { getStateConfig, SITE_URL, STATES } from "@/lib/config";
import { formatDate, formatINR, formatINR2, fyLabel, pct } from "@/lib/format";
import { imageKitEnabled, imageKitUrl } from "@/lib/imagekit";
import type { BrandDoc, SizePrice } from "@/lib/types";

export const ensureStatic = "navigation";

const PLACEHOLDER = "__none__";

/**
 * Prerender the most popular brands of every type at build time; the rest
 * render on their first visit and are then cached like any static page.
 * Parent params only cascade from layouts, so every segment is generated here.
 */
export async function generateStaticParams() {
  const out: { state: string; type: string; brand: string }[] = [];
  for (const s of STATES) {
    for (const t of await getTypes(s.slug)) {
      for (const b of await getPopularBrands(s.slug, 20, t.slug)) out.push({ state: s.slug, type: t.slug, brand: b.slug });
    }
  }
  return out.length ? out : [{ state: STATES[0].slug, type: PLACEHOLDER, brand: PLACEHOLDER }];
}

type Props = PageProps<"/prices/[state]/[type]/[brand]">;

async function load(params: Props["params"]) {
  const { state, type, brand } = await params;
  const cfg = getStateConfig(state);
  if (!cfg || brand === PLACEHOLDER) return null;
  const doc = await getBrand(state, type, brand);
  // Hidden through the Excel upload: behave as if the page doesn't exist.
  return doc && !doc.hidden ? { cfg, doc } : null;
}

function currentSizes(doc: BrandDoc): SizePrice[] {
  const cur = doc.sizes.filter((s) => s.isCurrent);
  return cur.length ? cur : doc.sizes;
}

function refSizeOf(doc: BrandDoc): SizePrice {
  const sizes = currentSizes(doc);
  return (
    (doc.refKey && sizes.find((s) => s.key === doc.refKey)) ||
    sizes.find((s) => s.label === doc.refSize && s.mrp === doc.refMrp) ||
    sizes[0]
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const { cfg, doc } = data;
  const fy = fyLabel(doc.latestFy);
  const sizes = currentSizes(doc);
  const sizeText = sizes
    .slice(0, 4)
    .map((s) => `${s.label} ${formatINR(s.mrp)}`)
    .join(", ");
  const path = `/prices/${doc.state}/${doc.typeSlug}/${doc.slug}`;
  // SEO title/description can be overridden per brand from the Excel upload.
  const title = doc.overrides?.seoTitle || `${doc.name} Price in ${cfg.name} ${fy}: ${doc.refSize} ${formatINR(doc.refMrp)}`;
  return {
    title,
    description:
      doc.overrides?.seoDescription ||
      `${doc.name} price in ${cfg.name} (FY ${fy}): ${sizeText}. Official MRP with excise duty, VAT breakdown and price history.`,
    alternates: { canonical: path },
    openGraph: {
      title,
      url: path,
      type: "website",
      images: doc.image && imageKitEnabled ? [{ url: imageKitUrl(doc.image, 1200, 630), width: 1200, height: 630 }] : undefined,
    },
  };
}

function Breakdown({ s }: { s: SizePrice }) {
  const tax = s.exciseDuty + s.exciseRounding + s.vat;
  const official = s.officialMrp ?? s.mrp;
  const rows: [string, number][] = [
    ["Wholesale price (WSP)", s.wsp],
    ["Excise duty", s.exciseDuty],
    ["Excise duty (rounding off)", s.exciseRounding],
    ["Retail margin", s.retailMargin],
    ["Sale price before VAT", s.salesPrice],
    ["VAT", s.vat],
  ];
  return (
    <details className="card !p-0">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
        <span className="font-medium text-slate-900">
          {s.label} {s.packageType}
        </span>
        <span className="text-sm text-slate-600">
          MRP <b className="text-slate-900">{formatINR(s.mrp)}</b> · tax {pct(tax, official)}
        </span>
      </summary>
      <table className="price-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="text-slate-600">{label}</td>
              <td className="text-right">{formatINR2(value)}</td>
            </tr>
          ))}
          <tr>
            <td className="font-semibold">MRP (excise list)</td>
            <td className="text-right font-semibold">{formatINR2(s.officialMrp ?? s.mrp)}</td>
          </tr>
        </tbody>
      </table>
      {s.overridden && (
        <p className="px-4 pb-3 text-xs text-slate-500">
          The breakdown follows the excise list price of {formatINR(s.officialMrp ?? s.mrp)}; the price shown on this page
          ({formatINR(s.mrp)}) has been updated by our editors.
        </p>
      )}
    </details>
  );
}

export default function BrandPage({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BrandContent params={params} />
    </Suspense>
  );
}

async function BrandContent({ params }: Pick<Props, "params">) {
  const data = await load(params);
  if (!data) notFound();
  const { cfg, doc } = data;

  const [related, changes, stats] = await Promise.all([
    getRelatedBrands(doc.state, doc.typeSlug, doc.slug, doc.refMrp, 8),
    getBrandChanges(doc.key),
    getStateStats(doc.state),
  ]);

  const fy = fyLabel(doc.latestFy);
  const path = `/prices/${doc.state}/${doc.typeSlug}/${doc.slug}`;
  const typePath = `/prices/${doc.state}/${doc.typeSlug}`;
  const sizes = currentSizes(doc);
  const ref = refSizeOf(doc);
  const refTax = ref.exciseDuty + ref.exciseRounding + ref.vat;
  const strength = sizes.find((s) => s.strength)?.strength ?? null;
  const withHistory = doc.sizes.filter((s) => s.history.length > 1);
  const lowerType = doc.typeName.toLowerCase();

  const faq: FaqItem[] = [
    {
      q: `What is the price of ${doc.name} ${ref.label} in ${cfg.name}?`,
      a: `The MRP of ${doc.name} ${ref.label} (${ref.packageType.toLowerCase()}) in ${cfg.name} is ${formatINR(ref.mrp)} for FY ${fyLabel(ref.fy)}, as per the ${cfg.sourceName}.`,
    },
    {
      q: `What sizes of ${doc.name} are available in ${cfg.name}?`,
      a: `${doc.name} is listed in ${sizes.length} size${sizes.length > 1 ? "s" : ""}: ${sizes.map((s) => `${s.label} (${formatINR(s.mrp)})`).join(", ")}.`,
    },
    {
      q: `How much tax is included in the price of ${doc.name}?`,
      a: `For the ${ref.label} bottle, excise duty and VAT add up to ${formatINR2(refTax)}, about ${pct(refTax, ref.officialMrp ?? ref.mrp)} of the ${formatINR(ref.officialMrp ?? ref.mrp)} excise-list MRP.`,
    },
  ];
  if (strength) {
    faq.push({ q: `What is the alcohol content of ${doc.name}?`, a: `${doc.name} is listed at ${strength}% v/v alcohol.` });
  }

  return (
    <article>
      <Breadcrumbs
        items={[
          { name: "Prices", href: "/prices" },
          { name: cfg.name, href: `/prices/${doc.state}` },
          { name: doc.typeName, href: typePath },
          { name: doc.name, href: path },
        ]}
      />

      <header className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        <BrandImage image={doc.image} name={doc.name} typeSlug={doc.typeSlug} size={160} priority className="shrink-0 rounded-xl bg-white" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-slate-900">
            {doc.name} Price in {cfg.name}
          </h1>
          <p className="mt-2 text-slate-700">
            {doc.name} costs <b>{formatINR(ref.mrp)}</b> for {ref.label} in {cfg.name}
            {sizes.length > 1 ? (
              <>
                , with {sizes.length} sizes from {formatINR(doc.minMrp)} to {formatINR(doc.maxMrp)}
              </>
            ) : null}
            . Official MRP for FY {fy}.
          </p>
          {!doc.isCurrent && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This brand is not on the latest price list. The prices below are the last ones published (FY {fy}).
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Type</dt>
              <dd>
                <Link href={typePath} className="font-medium text-slate-900 hover:text-amber-700 hover:underline">
                  {doc.typeName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Category</dt>
              <dd className="font-medium text-slate-900">{doc.kind}</dd>
            </div>
            {strength && (
              <div>
                <dt className="text-slate-500">Strength</dt>
                <dd className="font-medium text-slate-900">{strength}% v/v</dd>
              </div>
            )}
            {doc.origins.length > 0 && (
              <div>
                <dt className="text-slate-500">Made in</dt>
                <dd className="font-medium text-slate-900">{doc.origins.join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {doc.overrides?.description && (
        <section className="prose-lite mt-6 max-w-3xl">
          <h2 className="!mt-0">About {doc.name}</h2>
          {doc.overrides.description
            .split(/\n\s*\n/)
            .map((para) => para.trim())
            .filter(Boolean)
            .map((para, i) => (
              <p key={i}>{para}</p>
            ))}
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold text-slate-900">
          {doc.name} price list ({cfg.name}, FY {fy})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="price-table">
            <thead>
              <tr>
                <th>Size</th>
                <th>Pack</th>
                <th className="text-right">MRP</th>
                <th className="hidden sm:table-cell">Valid</th>
              </tr>
            </thead>
            <tbody>
              {doc.sizes.map((s) => (
                <tr key={s.key} id={s.key}>
                  <td className="font-medium">{s.label}</td>
                  <td className="text-slate-600">{s.packageType}</td>
                  <td className="whitespace-nowrap text-right font-semibold">
                    {formatINR(s.mrp)}
                    {!s.isCurrent && <span className="ml-1 text-xs font-normal text-slate-400">(FY {fyLabel(s.fy)})</span>}
                  </td>
                  <td className="hidden whitespace-nowrap text-slate-600 sm:table-cell">
                    {formatDate(s.validFrom)} – {formatDate(s.validTo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">Price breakdown: where your money goes</h2>
        <p className="mt-1 text-sm text-slate-600">
          Excise duty and VAT make up about {pct(refTax, ref.officialMrp ?? ref.mrp)} of the price of a {ref.label} bottle. Open a size to see
          the full calculation.
        </p>
        <div className="mt-3 space-y-2">
          {sizes.map((s) => (
            <Breakdown key={s.key} s={s} />
          ))}
        </div>
      </section>

      {withHistory.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-slate-900">{doc.name} price history</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="price-table">
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Financial year</th>
                  <th>Valid from</th>
                  <th className="text-right">MRP</th>
                </tr>
              </thead>
              <tbody>
                {withHistory.flatMap((s) =>
                  [...s.history].reverse().map((h, i) => (
                    <tr key={`${s.key}-${h.validFrom}-${i}`}>
                      <td>{i === 0 ? `${s.label} ${s.packageType}` : ""}</td>
                      <td>{fyLabel(h.fy)}</td>
                      <td>{formatDate(h.validFrom)}</td>
                      <td className="text-right font-semibold">{formatINR(h.mrp)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {changes.length > 0 && (
        <section className="card mt-8">
          <h2 className="text-lg font-bold text-slate-900">Recent changes</h2>
          <div className="mt-2">
            <ChangesList changes={changes} />
          </div>
        </section>
      )}

      <Faq items={faq} />

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900">Similar {lowerType} at a similar price</h2>
          <div className="mt-4">
            <BrandCards brands={related} />
          </div>
          <p className="mt-4 text-sm">
            <Link href={typePath} className="font-medium text-amber-700 hover:underline">
              See all {lowerType} prices in {cfg.name} →
            </Link>
          </p>
        </section>
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: doc.name,
          category: doc.typeName,
          url: `${SITE_URL}${path}`,
          ...(doc.image && imageKitEnabled ? { image: imageKitUrl(doc.image, 800, 800) } : {}),
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "INR",
            lowPrice: doc.minMrp,
            highPrice: doc.maxMrp,
            offerCount: sizes.length,
          },
        }}
      />
      <SourceNote sourceName={cfg.sourceName} sourceUrl={cfg.sourceUrl} lastSyncedAt={stats.lastSyncedAt} />
    </article>
  );
}
