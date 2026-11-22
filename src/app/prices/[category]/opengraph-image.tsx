import { CATEGORIES, getCategory } from "@/lib/categories";
import { getBrandsByCategory } from "@/lib/data";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from "@/lib/og";

export const alt = "Liquor prices in India by brand";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

/** Share image for a category page, e.g. "Whisky Prices in India · 60 brands". */
export default async function Image({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = getCategory(category);
  const brands = cat ? await getBrandsByCategory(category) : [];
  return ogCard({
    kicker: "Price list",
    title: `${cat?.name ?? "Liquor"} Prices in India`,
    subtitle: brands.length ? `${brands.length} brands · prices by state and bottle size` : "Prices by state and bottle size",
    badge: "All brands A-Z",
  });
}
