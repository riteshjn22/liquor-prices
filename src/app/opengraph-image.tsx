import { SITE_NAME } from "@/lib/config";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from "@/lib/og";

export const alt = `${SITE_NAME}: liquor prices, laws and dry days in India`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Default share image for every page that has no image of its own. */
export default function Image() {
  return ogCard({ kicker: "India's liquor information portal", title: "Liquor Prices, Dry Days & Excise Rules", subtitle: "Whisky, beer, wine, vodka, rum and brandy prices by state and bottle size" });
}
