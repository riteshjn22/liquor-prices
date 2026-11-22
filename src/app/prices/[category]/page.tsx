import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrandRows, Faq } from "@/components/Blocks";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { PageSkeleton } from "@/components/PageSkeleton";
import { RichText } from "@/components/RichText";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { SITE_URL } from "@/lib/config";
import { getBrandsByCategory, getFaqs, getPageContent } from "@/lib/data";
import { pageMetadata, webPageLd } from "@/lib/seo";
import type { BrandSummary } from "@/lib/types";

// Crawlers always get complete HTML.
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

type Props = PageProps<"/prices/[category]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) return {};
  const brands = await getBrandsByCategory(category);
  return pageMetadata({ title: categoryTitle(cat.name, brands.length), description: categoryDescription(cat.name, brands), path: `/prices/${category}`, ownImageFile: true });
}

const categoryTitle = (name: string, count: number) => `${name} Prices in India: ${count} Brands & Price Ranges`;
const categoryDescription = (name: string, brands: BrandSummary[]) =>
  `Compare ${name.toLowerCase()} prices in India for ${brands.length} brands${
    brands.length ? ` including ${brands.slice(0, 4).map((b) => b.name).join(", ")}` : ""
  }. Price ranges and state-wise prices by bottle size.`;

function letterOf(name: string) {
  const c = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

export default function CategoryPage({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CategoryContent params={params} />
    </Suspense>
  );
}

async function CategoryContent({ params }: Pick<Props, "params">) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) notFound();
  const [brands, about, faqs] = await Promise.all([getBrandsByCategory(category), getPageContent(`category:${category}:about`), getFaqs(`category:${category}`)]);
  const lower = cat.name.toLowerCase();

  const groups = new Map<string, BrandSummary[]>();
  for (const b of brands) {
    const l = letterOf(b.name);
    groups.set(l, [...(groups.get(l) ?? []), b]);
  }
  const letters = [...groups.keys()].sort((a, b) => (a === "#" ? -1 : b === "#" ? 1 : a.localeCompare(b)));

  return (
    <div>
      <Breadcrumbs items={[{ name: "Liquor Prices", href: "/prices" }, { name: cat.name, href: `/prices/${category}` }]} />
      <section className="pt-5 pb-4">
        <h1 className="text-[clamp(27px,4vw,40px)] font-extrabold leading-tight text-navy">{cat.name} Prices in India</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Browse {brands.length} {lower} brands and compare their price ranges. Open a brand to see prices for each variant and
          bottle size, state by state.
        </p>
      </section>
      <div className="note mb-6">
        <strong>Price information:</strong> each range runs from the lowest to the highest listed price across states and bottle
        sizes. Open a brand for the price of each variant and size.
      </div>

      <section className="border-b border-line pb-7">
        <h2 className="text-2xl font-bold">
          {cat.name} Brands &amp; Price Range
        </h2>
        <p className="mt-1 mb-4 text-muted">All {lower} brands, A to Z.</p>
        {letters.length > 1 && (
          <nav aria-label="Alphabetical navigation" className="mb-4 flex flex-wrap gap-2">
            {letters.map((l) => (
              <a key={l} href={`#letter-${l}`} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-bold text-link hover:border-link">
                {l}
              </a>
            ))}
          </nav>
        )}
        {brands.length === 0 ? (
          <p className="card text-muted">No {lower} brands are listed yet.</p>
        ) : (
          <div className="space-y-5">
            {letters.map((l) => (
              <div key={l} id={`letter-${l}`} className="scroll-mt-4">
                <h3 className="mb-2 text-sm font-bold tracking-wider text-muted">{l}</h3>
                <BrandRows brands={groups.get(l)!} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mt-6">
        <h2 className="text-xl font-bold">About {cat.name} Prices in India</h2>
        {about ? (
          // Written in the admin (Pages) or the Excel "Page content" sheet.
          <RichText html={about.html} className="mt-2" />
        ) : (
          <p className="mt-2 text-muted">
            {cat.name} prices differ by state because of excise duties, taxes, local pricing policies and availability. Each brand
            page lists the price per bottle size for the states where we have one.
          </p>
        )}
      </section>

      <Faq items={faqs} />

      <JsonLd
        data={webPageLd({
          type: "CollectionPage",
          path: `/prices/${category}`,
          name: categoryTitle(cat.name, brands.length),
          description: categoryDescription(cat.name, brands),
          hasBreadcrumb: true,
          extra: { about: { "@type": "Thing", name: cat.name } },
          mainEntity: {
            "@type": "ItemList",
            name: `${cat.name} brands in India`,
            numberOfItems: brands.length,
            itemListOrder: "https://schema.org/ItemListOrderAscending",
            itemListElement: brands.slice(0, 200).map((b, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/prices/${b.key}`, name: b.name })),
          },
        })}
      />
    </div>
  );
}
