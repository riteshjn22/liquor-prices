import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { formatRange, parsePriceRange } from "./brand-match";
import { CATEGORIES, categoryForExciseType, categoryForSheet, categoryFromText } from "./categories";
import { SITE_URL } from "./config";
import { parseMeasureMl, slugify } from "./normalize";
import { findState, stateName } from "./states";
import type { BrandDoc, ProductDoc, StatePrice } from "./types";

/*
 * Excel round-trip for the admin.
 *   Brands        one row per brand family (create, rename, enable/disable, price range, SEO text...)
 *   State prices  prices you add by hand for any state
 *   Delhi products  which official product belongs to which brand
 * Columns are matched by header text. Rows missing from an upload are left untouched.
 * Also accepts a plain brand list: sheets named "Whiskies", "Beers"... with Brand + Price columns.
 */

export const BRAND_COLS = {
  key: "Key (do not edit)",
  category: "Category",
  name: "Brand name",
  enabled: "Enabled",
  price: "Price range in India",
  note: "Price note",
  description: "Description",
  seoTitle: "SEO title",
  seoDescription: "SEO description",
  image: "Image path",
  matchWords: "Match words",
  products: "Delhi products matched",
  url: "Page URL",
} as const;

export const STATE_COLS = {
  id: "Price ID (do not edit)",
  brandKey: "Brand key",
  brand: "Brand",
  state: "State",
  variant: "Variant",
  size: "Size",
  mrp: "MRP",
  note: "Note / source",
  delete: "Delete",
} as const;

export const PRODUCT_COLS = {
  key: "Product key (do not edit)",
  name: "Official name",
  type: "Excise type",
  sizes: "Sizes and MRP",
  current: "On current list",
  auto: "Auto-matched brand",
  assign: "Assign to brand",
  label: "Variant name",
} as const;

const BRAND_EDITABLE = new Set<string>([BRAND_COLS.category, BRAND_COLS.name, BRAND_COLS.enabled, BRAND_COLS.price, BRAND_COLS.note, BRAND_COLS.description, BRAND_COLS.seoTitle, BRAND_COLS.seoDescription, BRAND_COLS.image, BRAND_COLS.matchWords]);
const STATE_EDITABLE = new Set<string>([STATE_COLS.brandKey, STATE_COLS.state, STATE_COLS.variant, STATE_COLS.size, STATE_COLS.mrp, STATE_COLS.note, STATE_COLS.delete]);
const PRODUCT_EDITABLE = new Set<string>([PRODUCT_COLS.assign, PRODUCT_COLS.label]);

const LIMITS = { name: 120, description: 5000, seoTitle: 120, seoDescription: 320, text: 200, maxMrp: 10_000_000 };

const FILL_READONLY: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
const FILL_EDIT_HEADER: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } };
const FILL_EDIT_CELL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };

function styleSheet(ws: ExcelJS.Worksheet, editable: Set<string>, widths: Record<string, number>) {
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 32;
  ws.columns.forEach((col, i) => {
    const name = String(col.header ?? "");
    col.width = widths[name] ?? 16;
    const cell = header.getCell(i + 1);
    cell.fill = editable.has(name) ? FILL_EDIT_HEADER : FILL_READONLY;
    cell.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } };
  });
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

function fillEditable(row: ExcelJS.Row, editable: Set<string>) {
  for (const h of editable) row.getCell(h).fill = FILL_EDIT_CELL;
}

const YES_NO: ExcelJS.DataValidation = { type: "list", allowBlank: true, formulae: ['"yes,no"'] };

export type ExportInput = {
  brands: BrandDoc[];
  statePrices: StatePrice[];
  products: Pick<ProductDoc, "key" | "name" | "typeName" | "typeSlug" | "isCurrent" | "sizes" | "brandKey" | "autoBrandKey" | "brandOverride" | "label">[];
};

export async function buildWorkbook({ brands, statePrices, products }: ExportInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Liquor Price Index";
  wb.created = new Date();
  const brandNames = new Map(brands.map((b) => [b.key, b.name]));
  const productCount = new Map<string, number>();
  for (const p of products) if (p.brandKey) productCount.set(p.brandKey, (productCount.get(p.brandKey) ?? 0) + 1);

  // --- Read me ---
  const help = wb.addWorksheet("Read me");
  help.getColumn(1).width = 120;
  const lines: [string, boolean?][] = [
    ["How to manage brands and prices with this file", true],
    [""],
    ["Edit only the YELLOW columns. Grey columns are for reference and are ignored on upload. Never change the 'do not edit' key columns."],
    ["Rows you delete from this file are left unchanged on the website. Upload on /admin: you will see every change before it is saved."],
    [""],
    ["Brands sheet: one row per brand (one page each, e.g. /prices/rum/old-monk)", true],
    ["Add a brand: add a row with Category (" + CATEGORIES.map((c) => c.slug).join(", ") + ") and Brand name, leave the Key blank."],
    ["Enabled: 'yes' shows the brand on the site, 'no' hides it (its page returns 404)."],
    ["Price range in India: e.g. ₹700 – ₹950. Shown as an approximate range. Price note: optional short note, e.g. 'Varietal'."],
    ["Match words: extra names used to find this brand in the Delhi excise list, comma-separated, e.g. 'mc dowells, mcdowell no 1'."],
    ["Description / SEO title / SEO description / Image path: optional content for the brand page."],
    ["Renaming a brand keeps its page URL. Category cannot be changed for an existing brand."],
    [""],
    ["State prices sheet: prices you add by hand for any state", true],
    ["Add a price: new row with Brand key (copy it from the Brands sheet), State (e.g. Haryana), Variant, Size (e.g. 750 ml) and MRP. Leave the Price ID blank."],
    ["Change a price: edit the row. Remove a price: type 'yes' in Delete."],
    ["Each brand page shows one price table per state that has prices. Delhi prices come from the excise department automatically."],
    [""],
    ["Delhi products sheet: official products from the Delhi excise list", true],
    ["Products are matched to brands automatically by name. To fix a match, type a brand key in 'Assign to brand', or 'none' to leave the product out."],
    ["Variant name: the name shown on the brand page instead of the automatic one."],
  ];
  lines.forEach(([text, bold], i) => {
    const cell = help.getCell(i + 1, 1);
    cell.value = text;
    cell.font = { bold: !!bold, size: bold ? 13 : 11 };
    cell.alignment = { wrapText: true };
  });

  // --- Brands ---
  const bws = wb.addWorksheet("Brands");
  bws.columns = Object.values(BRAND_COLS).map((h) => ({ header: h, key: h }));
  for (const b of brands) {
    const row = bws.addRow({
      [BRAND_COLS.key]: b.key,
      [BRAND_COLS.category]: b.category,
      [BRAND_COLS.name]: b.name,
      [BRAND_COLS.enabled]: b.enabled ? "yes" : "no",
      [BRAND_COLS.price]: b.priceText ?? "",
      [BRAND_COLS.note]: b.priceNote ?? "",
      [BRAND_COLS.description]: b.description ?? "",
      [BRAND_COLS.seoTitle]: b.seoTitle ?? "",
      [BRAND_COLS.seoDescription]: b.seoDescription ?? "",
      [BRAND_COLS.image]: b.image ?? "",
      [BRAND_COLS.matchWords]: (b.matchWords ?? []).join(", "),
      [BRAND_COLS.products]: productCount.get(b.key) ?? 0,
      [BRAND_COLS.url]: { text: `/prices/${b.key}`, hyperlink: `${SITE_URL}/prices/${b.key}` },
    });
    fillEditable(row, BRAND_EDITABLE);
    row.getCell(BRAND_COLS.enabled).dataValidation = YES_NO;
    row.getCell(BRAND_COLS.category).dataValidation = { type: "list", allowBlank: false, formulae: [`"${CATEGORIES.map((c) => c.slug).join(",")}"`] };
  }
  styleSheet(bws, BRAND_EDITABLE, {
    [BRAND_COLS.key]: 30,
    [BRAND_COLS.name]: 28,
    [BRAND_COLS.enabled]: 9,
    [BRAND_COLS.price]: 22,
    [BRAND_COLS.description]: 45,
    [BRAND_COLS.seoTitle]: 32,
    [BRAND_COLS.seoDescription]: 36,
    [BRAND_COLS.image]: 30,
    [BRAND_COLS.matchWords]: 26,
    [BRAND_COLS.url]: 34,
  });

  // --- State prices ---
  const sws = wb.addWorksheet("State prices");
  sws.columns = Object.values(STATE_COLS).map((h) => ({ header: h, key: h }));
  const sorted = [...statePrices].sort((a, b) => a.brandKey.localeCompare(b.brandKey) || a.state.localeCompare(b.state) || (a.ml ?? 0) - (b.ml ?? 0));
  for (const p of sorted) {
    const row = sws.addRow({
      [STATE_COLS.id]: p.id,
      [STATE_COLS.brandKey]: p.brandKey,
      [STATE_COLS.brand]: brandNames.get(p.brandKey) ?? "",
      [STATE_COLS.state]: stateName(p.state),
      [STATE_COLS.variant]: p.variant,
      [STATE_COLS.size]: p.size,
      [STATE_COLS.mrp]: p.mrp,
      [STATE_COLS.note]: p.note,
      [STATE_COLS.delete]: "",
    });
    fillEditable(row, STATE_EDITABLE);
    row.getCell(STATE_COLS.delete).dataValidation = YES_NO;
  }
  // A few blank, pre-coloured rows invite new entries.
  for (let i = 0; i < 20; i++) fillEditable(sws.addRow({}), STATE_EDITABLE);
  styleSheet(sws, STATE_EDITABLE, { [STATE_COLS.id]: 22, [STATE_COLS.brandKey]: 28, [STATE_COLS.brand]: 24, [STATE_COLS.state]: 18, [STATE_COLS.variant]: 30, [STATE_COLS.note]: 30, [STATE_COLS.delete]: 9 });
  sws.getColumn(STATE_COLS.mrp).numFmt = "#,##0";

  // --- Delhi products ---
  const pws = wb.addWorksheet("Delhi products");
  pws.columns = Object.values(PRODUCT_COLS).map((h) => ({ header: h, key: h }));
  const relevant = products
    .filter((p) => categoryForExciseType(p.typeSlug))
    .sort((a, b) => Number(!!b.brandKey) - Number(!!a.brandKey) || a.name.localeCompare(b.name));
  for (const p of relevant) {
    const sizes = p.sizes
      .filter((s) => s.isCurrent || !p.isCurrent)
      .map((s) => `${s.label} ₹${s.mrp.toLocaleString("en-IN")}`)
      .join("; ");
    const row = pws.addRow({
      [PRODUCT_COLS.key]: p.key,
      [PRODUCT_COLS.name]: p.name,
      [PRODUCT_COLS.type]: p.typeName,
      [PRODUCT_COLS.sizes]: sizes,
      [PRODUCT_COLS.current]: p.isCurrent ? "yes" : "no",
      [PRODUCT_COLS.auto]: p.autoBrandKey ?? "",
      [PRODUCT_COLS.assign]: p.brandOverride ?? "",
      [PRODUCT_COLS.label]: p.label ?? "",
    });
    fillEditable(row, PRODUCT_EDITABLE);
  }
  styleSheet(pws, PRODUCT_EDITABLE, { [PRODUCT_COLS.key]: 44, [PRODUCT_COLS.name]: 44, [PRODUCT_COLS.sizes]: 40, [PRODUCT_COLS.auto]: 26, [PRODUCT_COLS.assign]: 24, [PRODUCT_COLS.label]: 30 });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------------------------------------------------------------- import

export type ImportIssue = { sheet: string; row: number; message: string };
export type ImportChange = { key: string; brand: string; field: string; from: string; to: string };

export type BrandWrite = { key: string; isNew: boolean; set: Partial<BrandDoc> };
export type ImportPlan = {
  format: "workbook" | "brand-list";
  rows: { brands: number; statePrices: number; products: number };
  changes: ImportChange[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  brandWrites: BrandWrite[];
  priceCreates: StatePrice[];
  priceUpdates: { id: string; set: Partial<StatePrice> }[];
  priceDeletes: string[];
  productWrites: { key: string; set: Pick<ProductDoc, "brandOverride" | "label"> }[];
};

export type ImportContext = {
  brands: BrandDoc[];
  statePrices: StatePrice[];
  products: Pick<ProductDoc, "key" | "name" | "brandOverride" | "label">[];
};

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("").trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text).trim();
    if ("error" in value) return "";
  }
  return String(value).trim();
}

function headerMap(ws: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => map.set(cellText(cell.value).toLowerCase(), col));
  return map;
}

function parseYesNo(text: string): boolean | null | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  if (["yes", "y", "true", "1", "on", "enabled"].includes(t)) return true;
  if (["no", "n", "false", "0", "off", "disabled"].includes(t)) return false;
  return null;
}

function parsePrice(text: string): number | null | "invalid" {
  if (!text) return null;
  const n = Number(text.replace(/[₹,\s]|rs\.?/gi, ""));
  if (!Number.isFinite(n) || n <= 0 || n > LIMITS.maxMrp) return "invalid";
  return Math.round(n * 100) / 100;
}

const show = (v: unknown) => {
  if (v === undefined || v === null || v === "") return "(blank)";
  const s = Array.isArray(v) ? v.join(", ") : String(v);
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
};

const FIELD_LABELS: Partial<Record<keyof BrandDoc, string>> = {
  name: "Brand name",
  enabled: "Enabled",
  priceText: "Price range",
  priceNote: "Price note",
  description: "Description",
  seoTitle: "SEO title",
  seoDescription: "SEO description",
  image: "Image path",
  matchWords: "Match words",
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");

function priceFields(text: string, noteCell: string | undefined) {
  const r = parsePriceRange(text);
  return {
    priceText: r.min !== null ? formatRange(r.min, r.max) : "",
    priceMin: r.min,
    priceMax: r.max,
    priceNote: noteCell !== undefined && noteCell !== "" ? noteCell : r.note,
  };
}

export async function planImport(file: ArrayBuffer, ctx: ImportContext): Promise<ImportPlan> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(file) as unknown as ExcelJS.Buffer);

  const plan: ImportPlan = {
    format: "workbook",
    rows: { brands: 0, statePrices: 0, products: 0 },
    changes: [],
    errors: [],
    warnings: [],
    brandWrites: [],
    priceCreates: [],
    priceUpdates: [],
    priceDeletes: [],
    productWrites: [],
  };
  const brandByKey = new Map(ctx.brands.map((b) => [b.key, b]));
  // Brand keys created earlier in this same upload can be used by the State prices sheet.
  const newBrands = new Map<string, BrandWrite>();
  const now = new Date().toISOString();

  const queueBrand = (key: string, isNew: boolean, set: Partial<BrandDoc>, sheet: string, row: number) => {
    const existing = brandByKey.get(key);
    const pending = newBrands.get(key) ?? plan.brandWrites.find((w) => w.key === key);
    if (isNew && pending) {
      plan.warnings.push({ sheet, row, message: `"${set.name}" appears more than once; the first row is used.` });
      return;
    }
    const label = (set.name as string) ?? existing?.name ?? key;
    const diff: Partial<BrandDoc> = {};
    if (isNew) {
      Object.assign(diff, set);
      const price = set.priceText || set.priceNote ? ` · ${[set.priceText, set.priceNote].filter(Boolean).join(" ")}` : "";
      plan.changes.push({ key, brand: label, field: "New brand", from: "", to: `${key}${set.enabled === false ? " (disabled)" : ""}${price}` });
    } else {
      for (const [field, value] of Object.entries(set) as [keyof BrandDoc, unknown][]) {
        const before = existing ? existing[field] : undefined;
        if (same(before, value)) continue;
        (diff as Record<string, unknown>)[field] = value;
        if (field === "priceMin" || field === "priceMax") continue; // shown via priceText
        plan.changes.push({ key, brand: label, field: FIELD_LABELS[field] ?? field, from: show(field === "enabled" ? (before ? "yes" : "no") : before), to: show(field === "enabled" ? (value ? "yes" : "no") : value) });
      }
    }
    if (!Object.keys(diff).length) return;
    const w: BrandWrite = { key, isNew, set: diff };
    plan.brandWrites.push(w);
    if (isNew) newBrands.set(key, w);
  };

  const brandsWs = wb.getWorksheet("Brands");
  const listSheets = brandsWs ? [] : wb.worksheets.filter((ws) => categoryForSheet(ws.name) && headerMap(ws).has("brand"));

  // ---------- Plain brand list (e.g. your original "Liquor_Brands_Price_Range_India.xlsx")
  if (listSheets.length) {
    plan.format = "brand-list";
    for (const ws of listSheets) {
      const cat = categoryForSheet(ws.name)!;
      const h = headerMap(ws);
      const nameCol = h.get("brand")!;
      const priceCol = [...h.entries()].find(([k]) => k.includes("price"))?.[1];
      ws.eachRow((row, r) => {
        if (r === 1) return;
        const name = cellText(row.getCell(nameCol).value);
        if (!name) return;
        plan.rows.brands++;
        if (name.length > LIMITS.name) return void plan.errors.push({ sheet: ws.name, row: r, message: `Brand name is over ${LIMITS.name} characters.` });
        const slug = slugify(name);
        if (!slug) return void plan.errors.push({ sheet: ws.name, row: r, message: `Brand name "${name}" has no letters or numbers.` });
        const key = `${cat.slug}/${slug}`;
        const price = priceCol ? priceFields(cellText(row.getCell(priceCol).value), undefined) : undefined;
        if (brandByKey.has(key)) {
          // Existing brand: only refresh the price range (never touches enabled/content).
          if (price && (price.priceText || price.priceNote)) queueBrand(key, false, price, ws.name, r);
        } else {
          queueBrand(key, true, { key, category: cat.slug, slug, name, enabled: true, matchWords: [], image: null, createdAt: now, ...(price ?? { priceText: "", priceMin: null, priceMax: null, priceNote: "" }) }, ws.name, r);
        }
      });
    }
    return plan;
  }

  if (!brandsWs && !wb.getWorksheet("State prices") && !wb.getWorksheet("Delhi products")) {
    plan.errors.push({ sheet: "-", row: 0, message: 'No "Brands", "State prices" or "Delhi products" sheet, and no brand-list sheets (e.g. "Whiskies" with a "Brand" column). Start from a file downloaded from /admin.' });
    return plan;
  }

  // ---------- Brands sheet
  if (brandsWs) {
    const h = headerMap(brandsWs);
    const col = (name: string) => h.get(name.toLowerCase());
    if (!col(BRAND_COLS.key) || !col(BRAND_COLS.name)) {
      plan.errors.push({ sheet: "Brands", row: 1, message: `The Brands sheet needs the "${BRAND_COLS.key}" and "${BRAND_COLS.name}" columns.` });
    } else {
      brandsWs.eachRow((row, r) => {
        if (r === 1) return;
        const get = (name: string) => {
          const c = col(name);
          return c === undefined ? undefined : cellText(row.getCell(c).value);
        };
        const key = get(BRAND_COLS.key) ?? "";
        const name = get(BRAND_COLS.name) ?? "";
        const catText = get(BRAND_COLS.category) ?? "";
        if (!key && !name) return;
        plan.rows.brands++;
        const err = (message: string) => plan.errors.push({ sheet: "Brands", row: r, message });

        const existing = key ? brandByKey.get(key) : undefined;
        if (key && !existing) return void err(`Unknown brand key "${key}". Leave the key blank to add a new brand.`);
        if (!name) return void err("Brand name is required.");
        if (name.length > LIMITS.name) return void err(`Brand name is over ${LIMITS.name} characters.`);

        const set: Partial<BrandDoc> = { name };
        const enabled = parseYesNo(get(BRAND_COLS.enabled) ?? "");
        if (enabled === null) return void err(`Enabled must be "yes" or "no" (got "${get(BRAND_COLS.enabled)}").`);
        if (enabled !== undefined) set.enabled = enabled;

        const priceCell = get(BRAND_COLS.price);
        if (priceCell !== undefined) Object.assign(set, priceFields(priceCell, get(BRAND_COLS.note)));
        else if (get(BRAND_COLS.note) !== undefined) set.priceNote = get(BRAND_COLS.note);

        for (const [colName, field, limit] of [
          [BRAND_COLS.description, "description", LIMITS.description],
          [BRAND_COLS.seoTitle, "seoTitle", LIMITS.seoTitle],
          [BRAND_COLS.seoDescription, "seoDescription", LIMITS.seoDescription],
        ] as const) {
          const v = get(colName);
          if (v === undefined) continue;
          if (v.length > limit) return void err(`${colName} is over ${limit} characters.`);
          set[field] = v || undefined;
        }
        const seoTitle = get(BRAND_COLS.seoTitle);
        if (seoTitle && seoTitle.length > 60) plan.warnings.push({ sheet: "Brands", row: r, message: `SEO title is ${seoTitle.length} characters; Google usually cuts titles after about 60.` });

        const image = get(BRAND_COLS.image);
        if (image !== undefined) {
          if (image && (!image.startsWith("/") || /\s/.test(image) || image.startsWith("//"))) return void err('Image path must be an ImageKit path starting with "/" (no spaces), e.g. /brands/rum/old-monk.jpg');
          set.image = image || null;
        }
        const words = get(BRAND_COLS.matchWords);
        if (words !== undefined) set.matchWords = words.split(/[,;\n]/).map((w) => w.trim()).filter(Boolean);

        if (existing) {
          const cat = catText ? categoryFromText(catText) : undefined;
          if (catText && cat?.slug !== existing.category) plan.warnings.push({ sheet: "Brands", row: r, message: `Category can't be changed for an existing brand (it is part of the URL); kept "${existing.category}".` });
          queueBrand(existing.key, false, set, "Brands", r);
        } else {
          const cat = categoryFromText(catText);
          if (!cat) return void err(`Category must be one of: ${CATEGORIES.map((c) => c.slug).join(", ")} (got "${catText}").`);
          const slug = slugify(name);
          if (!slug) return void err(`Brand name "${name}" has no letters or numbers.`);
          const newKey = `${cat.slug}/${slug}`;
          if (brandByKey.has(newKey)) {
            plan.warnings.push({ sheet: "Brands", row: r, message: `"${name}" already exists as ${newKey}; this row updates it.` });
            queueBrand(newKey, false, set, "Brands", r);
          } else {
            queueBrand(newKey, true, { key: newKey, category: cat.slug, slug, enabled: true, matchWords: [], image: null, priceText: "", priceMin: null, priceMax: null, priceNote: "", createdAt: now, ...set }, "Brands", r);
          }
        }
      });
    }
  }

  const brandExists = (key: string) => brandByKey.has(key) || newBrands.has(key);
  const nameOf = (key: string) => brandByKey.get(key)?.name ?? (newBrands.get(key)?.set.name as string) ?? key;

  // ---------- State prices sheet
  const sws = wb.getWorksheet("State prices");
  if (sws) {
    const h = headerMap(sws);
    const col = (name: string) => h.get(name.toLowerCase());
    const priceById = new Map(ctx.statePrices.map((p) => [p.id, p]));
    if (!col(STATE_COLS.state) || !col(STATE_COLS.mrp) || (!col(STATE_COLS.brandKey) && !col(STATE_COLS.brand))) {
      plan.errors.push({ sheet: "State prices", row: 1, message: `The State prices sheet needs "${STATE_COLS.brandKey}" (or "${STATE_COLS.brand}"), "${STATE_COLS.state}" and "${STATE_COLS.mrp}" columns.` });
    } else {
      sws.eachRow((row, r) => {
        if (r === 1) return;
        const get = (name: string) => {
          const c = col(name);
          return c === undefined ? "" : cellText(row.getCell(c).value);
        };
        const id = get(STATE_COLS.id);
        const fields = [STATE_COLS.brandKey, STATE_COLS.brand, STATE_COLS.state, STATE_COLS.variant, STATE_COLS.size, STATE_COLS.mrp].map(get);
        if (!id && fields.every((f) => !f)) return; // empty row
        plan.rows.statePrices++;
        const err = (message: string) => plan.errors.push({ sheet: "State prices", row: r, message });
        const existing = id ? priceById.get(id) : undefined;
        if (id && !existing) return void err(`Unknown Price ID "${id}". Leave it blank for a new price.`);

        const del = parseYesNo(get(STATE_COLS.delete));
        if (del === null) return void err(`Delete must be "yes" or blank.`);
        if (del && existing) {
          plan.priceDeletes.push(existing.id);
          plan.changes.push({ key: existing.brandKey, brand: nameOf(existing.brandKey), field: `${stateName(existing.state)} price deleted`, from: `${existing.variant} ${existing.size} ₹${existing.mrp}`, to: "(deleted)" });
          return;
        }
        if (del && !existing) return;

        // Brand: key, or a unique brand name.
        let brandKey = get(STATE_COLS.brandKey);
        if (!brandKey) {
          const name = get(STATE_COLS.brand).toLowerCase();
          const matches = [...ctx.brands.map((b) => ({ key: b.key, name: b.name })), ...[...newBrands.values()].map((w) => ({ key: w.key, name: w.set.name as string }))].filter((b) => b.name.toLowerCase() === name);
          if (matches.length !== 1) return void err(matches.length ? `Brand "${get(STATE_COLS.brand)}" exists in several categories; fill in the Brand key.` : `Fill in the Brand key (e.g. rum/old-monk).`);
          brandKey = matches[0].key;
        }
        if (!brandExists(brandKey)) return void err(`Unknown brand key "${brandKey}".`);
        const state = findState(get(STATE_COLS.state));
        if (!state) return void err(`Unknown state "${get(STATE_COLS.state)}". Use the full name, e.g. Haryana, Uttar Pradesh.`);
        const mrp = parsePrice(get(STATE_COLS.mrp));
        if (mrp === "invalid" || mrp === null) return void err(`MRP must be a number between 1 and ${LIMITS.maxMrp.toLocaleString("en-IN")}.`);
        const variant = get(STATE_COLS.variant).slice(0, LIMITS.text);
        const size = get(STATE_COLS.size).slice(0, 40);
        const note = get(STATE_COLS.note).slice(0, LIMITS.text);
        const ml = size ? parseMeasureMl(size.replace(/litre|liter|ltr/i, "L").replace(/\bL\b/i, "Lt")) || null : null;
        const data = { brandKey, state: state.slug, variant, size, ml, mrp, note };

        if (existing) {
          const diff: Partial<StatePrice> = {};
          for (const [k, v] of Object.entries(data) as [keyof StatePrice, unknown][]) if (!same(existing[k], v)) (diff as Record<string, unknown>)[k] = v;
          if (!Object.keys(diff).length) return;
          plan.priceUpdates.push({ id: existing.id, set: { ...diff, updatedAt: now } });
          plan.changes.push({ key: brandKey, brand: nameOf(brandKey), field: `${state.name} price`, from: `${existing.variant} ${existing.size} ₹${existing.mrp}`, to: `${variant} ${size} ₹${mrp}` });
        } else {
          plan.priceCreates.push({ id: randomUUID(), ...data, updatedAt: now });
          plan.changes.push({ key: brandKey, brand: nameOf(brandKey), field: `New ${state.name} price`, from: "", to: `${variant} ${size} ₹${mrp}`.trim() });
        }
      });
    }
  }

  // ---------- Delhi products sheet
  const pws = wb.getWorksheet("Delhi products");
  if (pws) {
    const h = headerMap(pws);
    const keyCol = h.get(PRODUCT_COLS.key.toLowerCase());
    const assignCol = h.get(PRODUCT_COLS.assign.toLowerCase());
    const labelCol = h.get(PRODUCT_COLS.label.toLowerCase());
    const productByKey = new Map(ctx.products.map((p) => [p.key, p]));
    if (!keyCol) plan.errors.push({ sheet: "Delhi products", row: 1, message: `Missing the "${PRODUCT_COLS.key}" column.` });
    else {
      pws.eachRow((row, r) => {
        if (r === 1) return;
        const key = cellText(row.getCell(keyCol).value);
        if (!key) return;
        plan.rows.products++;
        const p = productByKey.get(key);
        if (!p) return void plan.errors.push({ sheet: "Delhi products", row: r, message: `Unknown product key "${key}".` });
        const set: Pick<ProductDoc, "brandOverride" | "label"> = { brandOverride: p.brandOverride ?? null, label: p.label ?? null };
        if (assignCol) {
          const v = cellText(row.getCell(assignCol).value).toLowerCase();
          if (v && v !== "none" && !brandExists(v)) return void plan.errors.push({ sheet: "Delhi products", row: r, message: `"Assign to brand" must be a brand key (e.g. rum/old-monk), "none", or blank (got "${v}").` });
          set.brandOverride = v || null;
        }
        if (labelCol) set.label = cellText(row.getCell(labelCol).value).slice(0, LIMITS.text) || null;
        if (same(set.brandOverride, p.brandOverride ?? null) && same(set.label, p.label ?? null)) return;
        plan.productWrites.push({ key, set });
        if (!same(set.brandOverride, p.brandOverride ?? null))
          plan.changes.push({ key, brand: p.name, field: "Assign to brand", from: show(p.brandOverride), to: set.brandOverride === "none" ? "none (left out)" : show(set.brandOverride ?? "(automatic)") });
        if (!same(set.label, p.label ?? null)) plan.changes.push({ key, brand: p.name, field: "Variant name", from: show(p.label), to: show(set.label) });
      });
    }
  }

  return plan;
}
