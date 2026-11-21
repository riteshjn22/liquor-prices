export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Liquor Price Index";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

export type StateConfig = {
  slug: string;
  name: string;
  sourceName: string;
  sourceUrl: string;
};

/**
 * States with a live price source. To add a state: write a source in
 * src/lib/sources/<state>.ts that returns PriceRow[], then register it here
 * and in src/lib/sources/index.ts.
 */
export const STATES: StateConfig[] = [
  {
    slug: "delhi",
    name: "Delhi",
    sourceName: "Excise Department, Govt. of NCT of Delhi",
    sourceUrl: "https://eabkari.delhi.gov.in/Reports/index.html",
  },
];

export function getStateConfig(slug: string): StateConfig | undefined {
  return STATES.find((s) => s.slug === slug);
}

/** Cache tag shared by every cached read of price data. Sync revalidates it. */
export const PRICES_TAG = "prices";
