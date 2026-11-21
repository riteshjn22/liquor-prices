import ExcelJS from "exceljs";
import { SITE_URL } from "./config";
import { cleanOverrides } from "./overrides";
import type { BrandDoc, BrandOverrides } from "./types";

/*
 * Excel round-trip for manual edits.
 * Export: official data (read-only, grey headers) + current overrides (editable, yellow headers).
 * Import: columns are matched by header text, so users may reorder/hide columns.
 * Brands or sizes missing from the file are left untouched; a blank editable cell clears that override.
 */

export const BRAND_COLS = {
  key: "Key (do not edit)",
  url: "Page URL",
  type: "Type",
  official: "Official name",
  name: "Display name",
  description: "Description",
  seoTitle: "SEO title",
  seoDescription: "SEO description",
  image: "Image path",
  hidden: "Hidden",
  refSize: "Headline size",
  refMrp: "Headline MRP",
  sizes: "Sizes",
  fy: "Latest FY",
  inSource: "On current excise list",
  updated: "Last synced",
} as const;

export const PRICE_COLS = {
  key: "Key (do not edit)",
  sizeKey: "Size key (do not edit)",
  brand: "Brand",
  size: "Size",
  pack: "Pack",
  official: "Official MRP",
  override: "MRP override",
  fy: "Financial year",
  validFrom: "Valid from",
  validTo: "Valid to",
  wsp: "Wholesale price",
  excise: "Excise duty",
  vat: "VAT",
  margin: "Retail margin",
} as const;

const BRAND_EDITABLE = new Set<string>([BRAND_COLS.name, BRAND_COLS.description, BRAND_COLS.seoTitle, BRAND_COLS.seoDescription, BRAND_COLS.image, BRAND_COLS.hidden]);
const PRICE_EDITABLE = new Set<string>([PRICE_COLS.override]);

const LIMITS = { name: 150, description: 5000, seoTitle: 120, seoDescription: 320, maxMrp: 10_000_000 };

const FILL_READONLY: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
const FILL_EDIT_HEADER: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } };
const FILL_EDIT_CELL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };

type ExportDoc = Pick<
  BrandDoc,
  "key" | "state" | "typeSlug" | "typeName" | "slug" | "name" | "officialName" | "sizes" | "refSize" | "refMrp" | "latestFy" | "inSource" | "updatedAt" | "image" | "overrides"
>;

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

export async function buildWorkbook(docs: ExportDoc[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Liquor Price Index";
  wb.created = new Date();

  // --- Read me ---
  const help = wb.addWorksheet("Read me");
  help.getColumn(1).width = 110;
  const lines: [string, boolean?][] = [
    ["How to edit prices and brand content with this file", true],
    [""],
    ["1. Edit only the YELLOW columns. Grey columns come from the excise department and are ignored on upload."],
    ["2. Never change the 'Key' columns: they tell the website which brand / size a row belongs to."],
    ["3. A blank yellow cell means 'no override': the official value is used. Clear a cell to undo an edit."],
    ["4. You can delete rows you did not change, filter, sort, reorder or hide columns. Missing rows are left as they are."],
    ["5. Save as .xlsx and upload it on the /admin page. You will see a preview of every change before it is applied."],
    [""],
    ["Brands sheet (yellow columns)", true],
    [`Display name: shown instead of the official name (max ${LIMITS.name} characters). The page URL never changes.`],
    [`Description: your own text about the brand, shown on its page (max ${LIMITS.description} characters). Leave an empty line between paragraphs.`],
    [`SEO title / SEO description: replace the automatic Google title (aim for under 60 characters) and description (under 160).`],
    ["Image path: the ImageKit file path, e.g. /brands/delhi/rum/old-monk-matured-xxx-select-rum-vov.jpg"],
    ["Hidden: type 'yes' to remove the brand from the site (its page returns 404). Clear it to show the brand again."],
    [""],
    ["Prices sheet (yellow column)", true],
    ["MRP override: a price shown instead of the official MRP for that size. Clear it to go back to the official price."],
    ["Overrides are kept when the daily sync updates official prices, so remember to clear them when the official list catches up."],
  ];
  lines.forEach(([text, bold], i) => {
    const cell = help.getCell(i + 1, 1);
    cell.value = text;
    cell.font = { bold: !!bold, size: bold ? 13 : 11 };
    cell.alignment = { wrapText: true };
  });

  // --- Brands ---
  const brands = wb.addWorksheet("Brands");
  brands.columns = Object.values(BRAND_COLS).map((h) => ({ header: h, key: h }));
  for (const d of docs) {
    const ov = d.overrides ?? {};
    const row = brands.addRow({
      [BRAND_COLS.key]: d.key,
      [BRAND_COLS.url]: { text: `/prices/${d.key}`, hyperlink: `${SITE_URL}/prices/${d.key}` },
      [BRAND_COLS.type]: d.typeName,
      [BRAND_COLS.official]: d.officialName ?? d.name,
      [BRAND_COLS.name]: ov.name ?? "",
      [BRAND_COLS.description]: ov.description ?? "",
      [BRAND_COLS.seoTitle]: ov.seoTitle ?? "",
      [BRAND_COLS.seoDescription]: ov.seoDescription ?? "",
      [BRAND_COLS.image]: d.image ?? "",
      [BRAND_COLS.hidden]: ov.hidden ? "yes" : "",
      [BRAND_COLS.refSize]: d.refSize,
      [BRAND_COLS.refMrp]: d.refMrp,
      [BRAND_COLS.sizes]: [...new Set(d.sizes.map((s) => s.label))].join(", "),
      [BRAND_COLS.fy]: d.latestFy,
      [BRAND_COLS.inSource]: d.inSource ? "yes" : "no",
      [BRAND_COLS.updated]: d.updatedAt?.slice(0, 10) ?? "",
    });
    for (const h of BRAND_EDITABLE) row.getCell(h).fill = FILL_EDIT_CELL;
    row.getCell(BRAND_COLS.hidden).dataValidation = { type: "list", allowBlank: true, formulae: ['"yes,no"'] };
  }
  styleSheet(brands, BRAND_EDITABLE, {
    [BRAND_COLS.key]: 44,
    [BRAND_COLS.url]: 44,
    [BRAND_COLS.official]: 40,
    [BRAND_COLS.name]: 32,
    [BRAND_COLS.description]: 50,
    [BRAND_COLS.seoTitle]: 36,
    [BRAND_COLS.seoDescription]: 40,
    [BRAND_COLS.image]: 36,
    [BRAND_COLS.hidden]: 9,
    [BRAND_COLS.sizes]: 28,
  });
  brands.getColumn(BRAND_COLS.refMrp).numFmt = "#,##0";

  // --- Prices ---
  const prices = wb.addWorksheet("Prices");
  prices.columns = Object.values(PRICE_COLS).map((h) => ({ header: h, key: h }));
  for (const d of docs) {
    for (const s of d.sizes) {
      const official = s.officialMrp ?? s.mrp;
      const override = d.overrides?.prices?.[s.key];
      const row = prices.addRow({
        [PRICE_COLS.key]: d.key,
        [PRICE_COLS.sizeKey]: s.key,
        [PRICE_COLS.brand]: d.name,
        [PRICE_COLS.size]: s.label,
        [PRICE_COLS.pack]: s.packageType,
        [PRICE_COLS.official]: official,
        [PRICE_COLS.override]: override ?? null,
        [PRICE_COLS.fy]: s.fy,
        [PRICE_COLS.validFrom]: s.validFrom ?? "",
        [PRICE_COLS.validTo]: s.validTo ?? "",
        [PRICE_COLS.wsp]: s.wsp,
        [PRICE_COLS.excise]: s.exciseDuty + s.exciseRounding,
        [PRICE_COLS.vat]: s.vat,
        [PRICE_COLS.margin]: s.retailMargin,
      });
      const cell = row.getCell(PRICE_COLS.override);
      cell.fill = FILL_EDIT_CELL;
      cell.dataValidation = {
        type: "decimal",
        operator: "between",
        allowBlank: true,
        formulae: [1, LIMITS.maxMrp],
        showErrorMessage: true,
        errorTitle: "Invalid price",
        error: "Enter a price in rupees, or leave blank to use the official MRP.",
      };
    }
  }
  styleSheet(prices, PRICE_EDITABLE, { [PRICE_COLS.key]: 44, [PRICE_COLS.sizeKey]: 24, [PRICE_COLS.brand]: 38, [PRICE_COLS.pack]: 14 });
  for (const h of [PRICE_COLS.official, PRICE_COLS.override]) prices.getColumn(h).numFmt = "#,##0";
  for (const h of [PRICE_COLS.wsp, PRICE_COLS.excise, PRICE_COLS.vat, PRICE_COLS.margin]) prices.getColumn(h).numFmt = "#,##0.00";

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------------------------------------------------------------- import

export type ImportIssue = { sheet: string; row: number; message: string };
export type ImportChange = { key: string; brand: string; field: string; from: string; to: string };
export type ImportPlan = {
  brandRows: number;
  priceRows: number;
  changes: ImportChange[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  /** key -> new overrides / image, only for brands that actually change */
  updates: Map<string, { overrides: BrandOverrides | undefined; image: string | null }>;
};

type ExistingDoc = Pick<BrandDoc, "key" | "name" | "image" | "overrides"> & { sizes: { key: string; label: string; packageType: string }[]; officialName?: string };

/** Normalise any ExcelJS cell value (rich text, hyperlink, formula, number, date) to a trimmed string. */
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

function parseHidden(text: string): boolean | null {
  const t = text.toLowerCase();
  if (["", "no", "n", "false", "0"].includes(t)) return false;
  if (["yes", "y", "true", "1", "hide", "hidden"].includes(t)) return true;
  return null;
}

function parsePrice(text: string): number | null | "invalid" {
  if (!text) return null;
  const n = Number(text.replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > LIMITS.maxMrp) return "invalid";
  return Math.round(n * 100) / 100;
}

const show = (v: unknown) => (v === undefined || v === null || v === "" ? "(blank)" : String(v).length > 80 ? String(v).slice(0, 77) + "…" : String(v));

export async function planImport(file: ArrayBuffer, existing: ExistingDoc[]): Promise<ImportPlan> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS types expect a Node Buffer; this is the same bytes.
  await wb.xlsx.load(Buffer.from(file) as unknown as ExcelJS.Buffer);

  const plan: ImportPlan = { brandRows: 0, priceRows: 0, changes: [], errors: [], warnings: [], updates: new Map() };
  const byKey = new Map(existing.map((d) => [d.key, d]));
  // Working copy of each touched brand's overrides.
  const draft = new Map<string, { overrides: BrandOverrides; image: string | null }>();
  const touch = (doc: ExistingDoc) => {
    let d = draft.get(doc.key);
    if (!d) {
      d = { overrides: { ...doc.overrides, prices: { ...doc.overrides?.prices } }, image: doc.image ?? null };
      draft.set(doc.key, d);
    }
    return d;
  };

  const brandsWs = wb.getWorksheet("Brands");
  const pricesWs = wb.getWorksheet("Prices");
  if (!brandsWs && !pricesWs) {
    plan.errors.push({ sheet: "-", row: 0, message: 'This file has no "Brands" or "Prices" sheet. Start from a file downloaded from /admin.' });
    return plan;
  }

  if (brandsWs) {
    const h = headerMap(brandsWs);
    const col = (name: string) => h.get(name.toLowerCase());
    const keyCol = col(BRAND_COLS.key);
    if (!keyCol) plan.errors.push({ sheet: "Brands", row: 1, message: `Missing the "${BRAND_COLS.key}" column.` });
    else {
      brandsWs.eachRow((row, r) => {
        if (r === 1) return;
        const key = cellText(row.getCell(keyCol).value);
        if (!key) return;
        plan.brandRows++;
        const doc = byKey.get(key);
        if (!doc) return void plan.errors.push({ sheet: "Brands", row: r, message: `Unknown brand key "${key}".` });
        const get = (name: string) => {
          const c = col(name);
          return c === undefined ? undefined : cellText(row.getCell(c).value);
        };
        const d = touch(doc);
        const official = doc.officialName ?? doc.name;

        const name = get(BRAND_COLS.name);
        if (name !== undefined) {
          if (name.length > LIMITS.name) plan.errors.push({ sheet: "Brands", row: r, message: `Display name is over ${LIMITS.name} characters.` });
          else d.overrides.name = name && name !== official ? name : undefined;
        }
        const description = get(BRAND_COLS.description);
        if (description !== undefined) {
          if (description.length > LIMITS.description) plan.errors.push({ sheet: "Brands", row: r, message: `Description is over ${LIMITS.description} characters.` });
          else d.overrides.description = description || undefined;
        }
        const seoTitle = get(BRAND_COLS.seoTitle);
        if (seoTitle !== undefined) {
          if (seoTitle.length > LIMITS.seoTitle) plan.errors.push({ sheet: "Brands", row: r, message: `SEO title is over ${LIMITS.seoTitle} characters.` });
          else {
            if (seoTitle.length > 60) plan.warnings.push({ sheet: "Brands", row: r, message: `SEO title is ${seoTitle.length} characters; Google usually cuts titles after about 60.` });
            d.overrides.seoTitle = seoTitle || undefined;
          }
        }
        const seoDescription = get(BRAND_COLS.seoDescription);
        if (seoDescription !== undefined) {
          if (seoDescription.length > LIMITS.seoDescription) plan.errors.push({ sheet: "Brands", row: r, message: `SEO description is over ${LIMITS.seoDescription} characters.` });
          else {
            if (seoDescription.length > 160) plan.warnings.push({ sheet: "Brands", row: r, message: `SEO description is ${seoDescription.length} characters; Google usually shows about 160.` });
            d.overrides.seoDescription = seoDescription || undefined;
          }
        }
        const image = get(BRAND_COLS.image);
        if (image !== undefined) {
          if (image && (!image.startsWith("/") || /\s/.test(image) || /^\/\//.test(image)))
            plan.errors.push({ sheet: "Brands", row: r, message: `Image path must be an ImageKit file path starting with "/" (no spaces), e.g. /brands/delhi/rum/x.jpg` });
          else d.image = image || null;
        }
        const hiddenText = get(BRAND_COLS.hidden);
        if (hiddenText !== undefined) {
          const hidden = parseHidden(hiddenText);
          if (hidden === null) plan.errors.push({ sheet: "Brands", row: r, message: `Hidden must be "yes" or blank (got "${hiddenText}").` });
          else d.overrides.hidden = hidden || undefined;
        }
      });
    }
  }

  if (pricesWs) {
    const h = headerMap(pricesWs);
    const keyCol = h.get(PRICE_COLS.key.toLowerCase());
    const sizeCol = h.get(PRICE_COLS.sizeKey.toLowerCase());
    const ovCol = h.get(PRICE_COLS.override.toLowerCase());
    if (!keyCol || !sizeCol || !ovCol) {
      plan.errors.push({ sheet: "Prices", row: 1, message: `The Prices sheet needs the "${PRICE_COLS.key}", "${PRICE_COLS.sizeKey}" and "${PRICE_COLS.override}" columns.` });
    } else {
      pricesWs.eachRow((row, r) => {
        if (r === 1) return;
        const key = cellText(row.getCell(keyCol).value);
        const sizeKey = cellText(row.getCell(sizeCol).value);
        if (!key && !sizeKey) return;
        plan.priceRows++;
        const doc = byKey.get(key);
        if (!doc) return void plan.errors.push({ sheet: "Prices", row: r, message: `Unknown brand key "${key}".` });
        if (!doc.sizes.some((s) => s.key === sizeKey)) return void plan.errors.push({ sheet: "Prices", row: r, message: `Unknown size key "${sizeKey}" for ${key}.` });
        const price = parsePrice(cellText(row.getCell(ovCol).value));
        if (price === "invalid") return void plan.errors.push({ sheet: "Prices", row: r, message: `MRP override must be a number between 1 and ${LIMITS.maxMrp.toLocaleString("en-IN")}, or blank.` });
        const d = touch(doc);
        d.overrides.prices ??= {};
        if (price === null) delete d.overrides.prices[sizeKey];
        else d.overrides.prices[sizeKey] = price;
      });
    }
  }

  // Diff the drafts against what is stored now; keep only real changes.
  for (const [key, d] of draft) {
    const doc = byKey.get(key)!;
    const before = doc.overrides ?? {};
    const after = cleanOverrides(d.overrides) ?? {};
    const brand = doc.name;
    const fields: [string, unknown, unknown][] = [
      ["Display name", before.name, after.name],
      ["Description", before.description, after.description],
      ["SEO title", before.seoTitle, after.seoTitle],
      ["SEO description", before.seoDescription, after.seoDescription],
      ["Hidden", before.hidden ? "yes" : "", after.hidden ? "yes" : ""],
      ["Image path", doc.image ?? "", d.image ?? ""],
    ];
    const sizeKeys = new Set([...Object.keys(before.prices ?? {}), ...Object.keys(after.prices ?? {})]);
    for (const sk of sizeKeys) {
      const size = doc.sizes.find((s) => s.key === sk);
      fields.push([`MRP override ${size ? `${size.label} ${size.packageType}` : sk}`, before.prices?.[sk], after.prices?.[sk]]);
    }
    let changed = false;
    for (const [field, from, to] of fields) {
      if ((from ?? "") === (to ?? "")) continue;
      changed = true;
      plan.changes.push({ key, brand, field, from: show(from), to: show(to) });
    }
    if (changed) plan.updates.set(key, { overrides: cleanOverrides(d.overrides), image: d.image });
  }
  return plan;
}
