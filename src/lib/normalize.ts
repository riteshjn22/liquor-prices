/** Collapse runs of whitespace and trim. Source values are padded with spaces. */
export function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function commonSuffix(values: string[]): string {
  if (!values.length) return "";
  let suffix = values[0];
  for (const v of values.slice(1)) {
    let i = 0;
    while (i < suffix.length && i < v.length && suffix[suffix.length - 1 - i] === v[v.length - 1 - i]) i++;
    suffix = suffix.slice(suffix.length - i);
  }
  return suffix;
}

/**
 * Some brand names have a contact e-mail glued on with no separator, e.g.
 * "BAROLO GRIMALDI DOCGMALHOTRA_X@HOTMAIL.COM". We can't tell where the name
 * ends from one row, so look at every name sharing the same e-mail domain:
 * their longest common ending is the e-mail address itself.
 */
export function detectEmailSuffixes(rawNames: string[]): string[] {
  const byDomain = new Map<string, string[]>();
  for (const name of rawNames) {
    const token = clean(name).replace(/\s*L1F\d{6,}$/i, "").split(" ").pop() ?? "";
    const at = token.indexOf("@");
    if (at < 0) continue;
    const domain = token.slice(at).toUpperCase();
    const list = byDomain.get(domain) ?? [];
    list.push(token.toUpperCase());
    byDomain.set(domain, list);
  }
  const suffixes: string[] = [];
  for (const tokens of byDomain.values()) {
    const distinct = [...new Set(tokens)];
    // With a single example we can't separate the name from the address; drop the whole token.
    suffixes.push(distinct.length > 1 ? commonSuffix(distinct) : distinct[0]);
  }
  return suffixes.sort((a, b) => b.length - a.length);
}

/**
 * Delhi brand names often carry an excise label code glued to the end,
 * e.g. "19 CRIMES SHIRAZ WINEL1F20228261", and sometimes an e-mail address.
 * Strip both, plus stray trailing dots.
 */
export function cleanBrandName(raw: string, emailSuffixes: string[] = []): string {
  let name = clean(raw).replace(/\s*L1F\d{6,}$/i, "");
  const upper = name.toUpperCase();
  const suffix = emailSuffixes.find((s) => upper.endsWith(s));
  if (suffix) name = name.slice(0, name.length - suffix.length);
  // Any address we still couldn't isolate: drop the whole token so it is never published.
  name = name.replace(/\s*\S*@\S*/g, "");
  return name
    .replace(/\s*L1F\d{6,}$/i, "")
    .replace(/[.\s,/-]+$/, "")
    .trim();
}

const KEEP_UPPER = new Set([
  "VS", "VSOP", "XO", "XXO", "IPA", "APA", "NAS", "USA", "UK", "BBQ", "DOC", "DOCG", "AOC",
  "IGT", "IMFL", "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "XXX", "XL", "XXL",
  "PX", "TV", "NV", "GSM", "ABV", "OK", "DJ", "J&B", "SM", "YO", "S/W", "IMFS", "BIO", "VOV", "VSO", "XXXX",
]);
const LOWER_WORDS = new Set(["of", "the", "and", "de", "la", "le", "du", "des", "di", "da", "del", "y", "et", "en", "by", "on", "in", "for", "with"]);

function capitalizeSegment(segment: string): string {
  if (!segment) return segment;
  if (/^mc[a-z]{2,}/i.test(segment)) {
    return "Mc" + segment.charAt(2).toUpperCase() + segment.slice(3).toLowerCase();
  }
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

/** "OLD MONK THE LEGEND XXX RUM" -> "Old Monk the Legend XXX Rum" */
export function titleCase(value: string): string {
  const words = clean(value).split(" ");
  return words
    .map((word, i) => {
      const upper = word.toUpperCase();
      if (KEEP_UPPER.has(upper.replace(/[^A-Z&]/g, ""))) return upper;
      if (/\d/.test(word)) return word.toLowerCase().replace(/^([a-z])/, (c) => c.toUpperCase());
      const lower = word.toLowerCase();
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      // Capitalise each part of hyphenated / slashed / apostrophe words.
      return word
        .split(/([-/.'’(])/)
        .map((part, j, parts) => {
          // keep the letter after an apostrophe lowercase: "Teacher's"
          if (j > 0 && (parts[j - 1] === "'" || parts[j - 1] === "’") && part.length <= 2) return part.toLowerCase();
          return capitalizeSegment(part);
        })
        .join("");
    })
    .join(" ");
}

/** "750 Ml." -> 750, "50 Lt." -> 50000, "700 quart(US)" -> 700 */
export function parseMeasureMl(measure: string): number {
  const m = clean(measure).match(/^([\d.]+)\s*([a-z]*)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "lt" || unit === "l" || unit === "ltr" || unit === "litre" || unit === "liter") return Math.round(n * 1000);
  return Math.round(n);
}

export function sizeLabel(ml: number): string {
  if (ml >= 1000) {
    const l = ml / 1000;
    return `${Number.isInteger(l) ? l : l.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} L`;
  }
  return `${ml} ml`;
}

/** "42.8 %V/V" -> 42.8; zero/unknown -> null */
export function parseStrength(value: string): number | null {
  const n = parseFloat(clean(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ddmmyyyyToIso(value: string): string | null {
  const m = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** "( 18/10/2024 - 30/06/2025 )" -> { from: "2024-10-18", to: "2025-06-30" } */
export function parseValidRange(value: string): { from: string | null; to: string | null } {
  const [a = "", b = ""] = clean(value).replace(/[()]/g, "").split(" - ");
  return { from: ddmmyyyyToIso(a), to: ddmmyyyyToIso(b) };
}

const ORIGIN_FIXES: Record<string, string> = {
  UTTRAKHAND: "Uttarakhand",
  CHATTISGARH: "Chhattisgarh",
  "DAMAN & DIU": "Daman & Diu",
  "JAMMU AND KASHMIR": "Jammu and Kashmir",
};

export function normalizeOrigin(value: string): string | null {
  const v = clean(value).toUpperCase();
  if (!v || v === "N/A" || v === "NA") return null;
  return ORIGIN_FIXES[v] ?? titleCase(v);
}

export function normalizeKind(value: string): string {
  return clean(value).replace(/\s*\(/, " (");
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
