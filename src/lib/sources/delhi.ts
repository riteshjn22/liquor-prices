import { createHash } from "node:crypto";
import type { DelhiRawRow, PriceRow } from "../types";
import {
  clean,
  cleanBrandName,
  detectEmailSuffixes,
  normalizeKind,
  normalizeOrigin,
  parseMeasureMl,
  parseStrength,
  parseValidRange,
  round2,
  sizeLabel,
  slugify,
  titleCase,
} from "../normalize";

export const DELHI_API_URL = "https://eabkari.delhi.gov.in/WEbservice.asmx/GetBrandPriceList";

/** Guard against a half-empty or broken response wiping good data. */
const MIN_EXPECTED_ROWS = 1000;

export type SourceFetch = { rows: PriceRow[]; rawCount: number; hash: string };
export type FetchOptions = { attempts?: number; timeoutMs?: number };

/** The government server sometimes drops connections mid-download, so retry with a short pause. */
async function downloadWithRetry(url: string, { attempts = 3, timeoutMs = 90_000 }: FetchOptions): Promise<string> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; LiquorPriceIndexBot/1.0)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      const cause = (err as { cause?: { code?: string } }).cause?.code;
      console.warn(`[delhi] attempt ${i}/${attempts} failed: ${(err as Error).message}${cause ? ` (${cause})` : ""}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
  throw new Error(`Delhi source unreachable after ${attempts} attempts: ${(lastError as Error)?.message ?? lastError}`);
}

export async function fetchDelhi(opts: FetchOptions = {}): Promise<SourceFetch> {
  const text = await downloadWithRetry(DELHI_API_URL, opts);
  let json: unknown = JSON.parse(text);
  // ASMX services sometimes wrap the payload as { d: "<json string>" }.
  if (json && typeof json === "object" && "d" in json) {
    const d = (json as { d: unknown }).d;
    json = typeof d === "string" ? JSON.parse(d) : d;
  }
  const obj = json as { details?: DelhiRawRow[]; Details?: DelhiRawRow[] } | DelhiRawRow[];
  const raw = Array.isArray(obj) ? obj : obj.details ?? obj.Details ?? [];

  if (raw.length < MIN_EXPECTED_ROWS) {
    throw new Error(`Delhi source returned only ${raw.length} rows (expected at least ${MIN_EXPECTED_ROWS}); keeping existing data`);
  }

  const emailSuffixes = detectEmailSuffixes(raw.map((r) => r.Brand_Name));
  // Rows without an MRP are brands registered but not yet priced; skip them.
  const rows = raw.map((r) => normalizeDelhiRow(r, emailSuffixes)).filter((r): r is PriceRow => r !== null);
  const hash = createHash("sha256").update(text).digest("hex");
  return { rows, rawCount: raw.length, hash };
}

export function normalizeDelhiRow(r: DelhiRawRow, emailSuffixes: string[] = []): PriceRow | null {
  const brandName = titleCase(cleanBrandName(r.Brand_Name, emailSuffixes));
  // Keep the raw name for search, minus any e-mail address.
  const brandRaw = clean(r.Brand_Name).replace(/\S*@\S*/g, "").trim();
  const brandSlug = slugify(brandName);
  const typeName = clean(r.Liquor_Type_Desc);
  const ml = parseMeasureMl(r.Measure);
  const mrp = round2(r.MRP);
  if (!brandSlug || !typeName || !ml || !(mrp > 0)) return null;

  const { from, to } = parseValidRange(r.v_range);
  return {
    state: "delhi",
    fy: clean(r.Financial_Year),
    category: clean(r.Liquor_Cat_Desc),
    kind: normalizeKind(r.Liquor_Kind_Desc),
    typeName,
    typeSlug: slugify(typeName),
    brandRaw,
    brandName,
    brandSlug,
    packageType: clean(r.Package_Type_desc) || "Bottle",
    origin: normalizeOrigin(r.State_Desc),
    ml,
    sizeLabel: sizeLabel(ml),
    strength: parseStrength(r.Strength),
    validFrom: from,
    validTo: to,
    supplier: titleCase(clean(r.SiteName).replace(/^M\/S\.?\s*/i, "")),
    wsp: round2(r.WHOLESALE_PRICE_WSP_PER_UNIT),
    exciseDuty: round2(r.EXCISE_DUTY_PER_UNIT),
    exciseRounding: round2(r.EXCISE_DUTY_ON_ACCOUNT_OF_ROUNDING_OFF_PER_UNIT),
    retailMargin: round2(r.RETAIL_MARGIN_PER_UNIT),
    salesPrice: round2(r.SALES_PRICE_PER_UNIT),
    vat: round2(r.TOTAL_VAT_PER_UNIT),
    mrp,
  };
}
