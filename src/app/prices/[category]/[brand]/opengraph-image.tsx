import { priceLabel } from "@/components/Blocks";
import { getCategory } from "@/lib/categories";
import { getAllBrandParams, getBrandsByCategory } from "@/lib/data";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard, ogPrice } from "@/lib/og";

export const alt = "Brand price in India by state and bottle size";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const PLACEHOLDER = "__none__";

export async function generateStaticParams() {
  const params = await getAllBrandParams();
  return params.length ? params : [{ category: "whisky", brand: PLACEHOLDER }];
}

/** Share image for a brand page: "Old Monk Price in India" with its low-high price range. */
export default async function Image({ params }: { params: Promise<{ category: string; brand: string }> }) {
  const { category, brand } = await params;
  const cat = getCategory(category);
  const b = cat && brand !== PLACEHOLDER ? (await getBrandsByCategory(category)).find((x) => x.slug === brand) : undefined;
  if (!b) return ogCard({ kicker: "Price list", title: "Liquor Price in India" });
  const price = priceLabel(b);
  return ogCard({
    kicker: `${cat!.name} price`,
    title: `${b.name} Price in India`,
    subtitle: b.stateCount ? `Prices for ${b.stateCount} state${b.stateCount === 1 ? "" : "s"} · all bottle sizes` : "Variants and bottle sizes",
    badge: price.pending ? undefined : ogPrice(price.main),
  });
}
