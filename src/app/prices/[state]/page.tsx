import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageSkeleton } from "@/components/PageSkeleton";
import { BrandCards, ChangesList, Faq, SourceNote, TypeGrid } from "@/components/Blocks";
import { getPopularBrands, getRecentChanges, getStateStats, getTypes } from "@/lib/data";
import { getStateConfig, STATES } from "@/lib/config";
import { formatINR, fyLabel } from "@/lib/format";

// Crawlers and users always get complete HTML; unknown params render once, then are cached.
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return STATES.map((s) => ({ state: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/prices/[state]">): Promise<Metadata> {
  const { state } = await params;
  const cfg = getStateConfig(state);
  if (!cfg) return {};
  const stats = await getStateStats(state);
  const fy = stats.latestFy ? ` ${fyLabel(stats.latestFy)}` : "";
  return {
    title: `${cfg.name} Liquor Price List${fy}: Whisky, Beer, Rum, Vodka MRP`,
    description: `Latest official MRP of ${stats.brandCount.toLocaleString("en-IN")} liquor brands in ${cfg.name}${fy}: whisky, beer, rum, vodka, gin, wine and more, from the ${cfg.sourceName}.`,
    alternates: { canonical: `/prices/${state}` },
  };
}

// params are read inside <Suspense> so client navigations stay instant.
// All data is cached, so the full page is still in the prerendered HTML.
export default function StatePage({ params }: PageProps<"/prices/[state]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StateContent params={params} />
    </Suspense>
  );
}

async function StateContent({ params }: Pick<PageProps<"/prices/[state]">, "params">) {
  const { state } = await params;
  const cfg = getStateConfig(state);
  if (!cfg) notFound();

  const [stats, types, popular, changes] = await Promise.all([
    getStateStats(state),
    getTypes(state),
    getPopularBrands(state, 16),
    getRecentChanges(state, 15),
  ]);
  const fy = fyLabel(stats.latestFy);
  const cheapestType = [...types].sort((a, b) => a.minMrp - b.minMrp)[0];

  return (
    <div>
      <Breadcrumbs items={[{ name: "Prices", href: "/prices" }, { name: cfg.name, href: `/prices/${state}` }]} />
      <h1 className="mt-4 text-3xl font-bold text-slate-900">
        {cfg.name} Liquor Price List {fy}
      </h1>
      <p className="mt-2 max-w-3xl text-slate-700">
        Official maximum retail prices (MRP) for {stats.brandCount.toLocaleString("en-IN")} brands sold in {cfg.name},
        across {types.length} categories. Prices come from the {cfg.sourceName} and are checked every day.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">Browse by type</h2>
        <div className="mt-4">
          <TypeGrid state={state} types={types} />
        </div>
      </section>

      {popular.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900">Popular brands in {cfg.name}</h2>
          <div className="mt-4">
            <BrandCards brands={popular} />
          </div>
        </section>
      )}

      <section className="card mt-10">
        <h2 className="text-xl font-bold text-slate-900">Recent price changes</h2>
        <div className="mt-3">
          <ChangesList changes={changes} />
        </div>
      </section>

      <Faq
        items={[
          {
            q: `Where do these ${cfg.name} liquor prices come from?`,
            a: `They are the official MRPs published by the ${cfg.sourceName} for FY ${fy}. We check the list daily and update prices when it changes.`,
          },
          {
            q: `How many liquor brands are sold in ${cfg.name}?`,
            a: `The current list has ${stats.brandCount.toLocaleString("en-IN")} brand entries across ${types.length} categories, including ${types
              .slice(0, 4)
              .map((t) => t.name.toLowerCase())
              .join(", ")}.`,
          },
          ...(cheapestType
            ? [
                {
                  q: `What is the cheapest drink you can buy in ${cfg.name}?`,
                  a: `The lowest MRP on the list is ${formatINR(cheapestType.minMrp)} in the ${cheapestType.name} category (smallest pack size).`,
                },
              ]
            : []),
          {
            q: "Can a shop charge more than the MRP?",
            a: "No. MRP is the maximum retail price including all taxes. A shop may sell below MRP but not above it.",
          },
        ]}
      />
      <SourceNote sourceName={cfg.sourceName} sourceUrl={cfg.sourceUrl} lastSyncedAt={stats.lastSyncedAt} />
    </div>
  );
}
