/** One row exactly as the Delhi excise API returns it. */
export type DelhiRawRow = {
  SrNo: number;
  LicenseeNameWithId: string;
  SiteName: string;
  DistrictName: string;
  Financial_Year: string;
  Liquor_Cat_Desc: string;
  Liquor_Kind_Desc: string;
  Liquor_Type_Desc: string;
  Brand_Name: string;
  Package_Type_desc: string;
  State_Desc: string;
  Measure: string;
  Strength: string;
  v_range: string;
  WHOLESALE_PRICE_WSP_PER_UNIT: number;
  EXCISE_DUTY_PER_UNIT: number;
  RETAIL_MARGIN_PER_UNIT: number;
  EXCISE_DUTY_ON_ACCOUNT_OF_ROUNDING_OFF_PER_UNIT: number;
  SALES_PRICE_PER_UNIT: number;
  TOTAL_VAT_PER_UNIT: number;
  MRP: number;
};

/** A cleaned, source-independent price row. Every state source maps into this. */
export type PriceRow = {
  state: string; // state slug where this price applies, e.g. "delhi"
  fy: string; // "2026-2027"
  category: string;
  kind: string; // "Indian Liquor (IL)"
  typeName: string; // "Beer (Strong)"
  typeSlug: string; // "beer-strong"
  brandRaw: string; // as in source, whitespace-collapsed
  brandName: string; // cleaned display name
  brandSlug: string;
  packageType: string; // "Glass Bottle"
  origin: string | null; // where it is manufactured
  ml: number;
  sizeLabel: string; // "750 ml", "1 L"
  strength: number | null; // % v/v
  validFrom: string | null; // YYYY-MM-DD
  validTo: string | null;
  supplier: string;
  wsp: number;
  exciseDuty: number;
  exciseRounding: number;
  retailMargin: number;
  salesPrice: number;
  vat: number;
  mrp: number;
};

export type PricePoint = {
  fy: string;
  validFrom: string | null;
  validTo: string | null;
  mrp: number;
};


export type SizePrice = {
  key: string; // "750-ml-glass-bottle"
  ml: number;
  label: string;
  packageType: string;
  strength: number | null;
  fy: string;
  validFrom: string | null;
  validTo: string | null;
  mrp: number;
  wsp: number;
  exciseDuty: number;
  exciseRounding: number;
  retailMargin: number;
  salesPrice: number;
  vat: number;
  isCurrent: boolean; // price is from the latest financial year in the feed
  history: PricePoint[]; // oldest first, repeated prices collapsed
};

/**
 * One product from a state excise list (e.g. "Old Monk Matured XXX Select Rum VOV").
 * Products are not pages; they are shown inside their brand's page.
 */
export type ProductDoc = {
  key: string; // "delhi/rum/old-monk-matured-xxx-select-rum-vov"
  state: string;
  typeSlug: string; // excise type, e.g. "beer-strong"
  typeName: string;
  slug: string;
  name: string;
  rawNames: string[];
  kind: string;
  category: string;
  origins: string[];
  suppliers: string[];
  sizes: SizePrice[];
  minMrp: number;
  maxMrp: number;
  refMrp: number;
  refSize: string;
  refKey?: string;
  latestFy: string;
  isCurrent: boolean;
  inSource: boolean;
  createdAt: string;
  updatedAt: string;
  priceChangedAt?: string | null;
  // ---- set by brand matching / admin (never overwritten by sync) ----
  /** Brand this product is shown under (override if set, else automatic match). */
  brandKey?: string | null;
  autoBrandKey?: string | null;
  /** Admin override: a brand key, or "none" to keep the product off the site. */
  brandOverride?: string | null;
  /** Admin override for the variant name shown on the brand page. */
  label?: string | null;
};

/** A brand family from your brand list, e.g. "Old Monk". One page each: /prices/<category>/<slug>. */
export type BrandDoc = {
  key: string; // "rum/old-monk"
  category: string; // "rum"
  slug: string; // never changes once created (keeps URLs stable)
  name: string;
  enabled: boolean;
  /** Picked in the admin for the home page "Popular Brands" list. */
  featured?: boolean;
  /** Approximate India price range as typed in Excel, e.g. "Rs 500 - Rs 800". */
  priceText: string;
  priceMin: number | null;
  priceMax: number | null;
  priceNote: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  image?: string | null;
  /** Extra names used to find this brand's products in excise lists, e.g. ["mc-dowells"]. */
  matchWords: string[];
  createdAt: string;
  updatedAt: string;
};

/** A price added by hand (through Excel) for a state without an automatic source. */
export type StatePrice = {
  id: string;
  brandKey: string;
  state: string; // state slug, e.g. "haryana"
  variant: string;
  size: string; // as typed, e.g. "750 ml"
  ml: number | null;
  mrp: number;
  note: string;
  updatedAt: string;
};

export type BrandSummary = Pick<BrandDoc, "key" | "category" | "slug" | "name" | "priceText" | "priceMin" | "priceMax" | "priceNote" | "image"> & {
  /** Lowest / highest official MRP among this brand's listed products, if any. */
  officialMin: number | null;
  officialMax: number | null;
  productCount: number;
  stateCount: number;
};

export type CategorySummary = {
  slug: string;
  name: string;
  emoji: string;
  brandCount: number;
};

export type PriceChange = {
  state: string;
  productKey: string;
  productName: string;
  sizeKey: string;
  sizeLabel: string;
  oldMrp: number;
  newMrp: number;
  detectedAt: string;
};

/** A price change resolved to the brand page it appears on. */
export type BrandPriceChange = PriceChange & { brandKey: string; brandName: string; variant: string };

export type SyncResult = {
  state: string;
  status: "updated" | "unchanged" | "failed";
  rows: number;
  products: number;
  inserted: number;
  updated: number;
  priceChanges: number;
  matched?: number;
  ms: number;
  error?: string;
};