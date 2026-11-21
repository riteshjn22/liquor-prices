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
  /** Price from the excise list. `mrp` above is what the site shows (override or official). */
  officialMrp?: number;
  overridden?: boolean;
};

/** Manual edits made through the Excel upload. The daily sync never overwrites these. */
export type BrandOverrides = {
  name?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  hidden?: boolean;
  /** sizeKey -> MRP shown instead of the official one */
  prices?: Record<string, number>;
};

export type BrandDoc = {
  key: string; // "delhi/whisky/old-monk"
  state: string;
  typeSlug: string;
  typeName: string;
  slug: string; // never changes, even if the display name is overridden (keeps URLs stable)
  name: string; // effective display name
  officialName?: string;
  rawNames: string[];
  kind: string;
  category: string;
  origins: string[];
  suppliers: string[];
  sizes: SizePrice[];
  minMrp: number;
  maxMrp: number;
  /** MRP of the "headline" size (750 ml if sold, else nearest common bottle). */
  refMrp: number;
  refSize: string;
  refKey?: string;
  latestFy: string;
  isCurrent: boolean;
  inSource: boolean;
  hidden?: boolean;
  overrides?: BrandOverrides;
  /** Optional ImageKit path override. Never overwritten by sync. */
  image?: string | null;
  createdAt: string;
  updatedAt: string;
  priceChangedAt?: string | null;
};

export type BrandSummary = Pick<
  BrandDoc,
  | "key"
  | "state"
  | "typeSlug"
  | "typeName"
  | "slug"
  | "name"
  | "kind"
  | "minMrp"
  | "maxMrp"
  | "refMrp"
  | "refSize"
  | "latestFy"
  | "isCurrent"
  | "image"
> & { sizeLabels: string[] };

export type TypeSummary = {
  state: string;
  slug: string;
  name: string;
  brandCount: number;
  minMrp: number; // smallest pack of any brand
  maxMrp: number; // largest pack (can be a 50 L keg)
  minRef: number; // cheapest headline bottle (usually 750 ml)
  maxRef: number; // priciest headline bottle
};

export type PriceChange = {
  state: string;
  brandKey: string;
  brandName: string;
  typeSlug: string;
  brandSlug: string;
  sizeKey: string;
  sizeLabel: string;
  oldMrp: number;
  newMrp: number;
  detectedAt: string;
};

export type SyncResult = {
  state: string;
  status: "updated" | "unchanged" | "failed";
  rows: number;
  brands: number;
  inserted: number;
  updated: number;
  priceChanges: number;
  ms: number;
  error?: string;
};
