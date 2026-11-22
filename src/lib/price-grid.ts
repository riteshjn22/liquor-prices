import { randomUUID } from "node:crypto";
import type ExcelJS from "exceljs";
import { variantLabel } from "./brand-match";
import { STATES } from "./config";
import { parseMeasureMl, sizeLabel } from "./normalize";
import { findState, stateName } from "./states";
import type { BrandDoc, ProductDoc, StatePrice } from "./types";

/*
 * "Prices by state" sheet: one row per brand + variant + size, one column per state.
 *   - Official prices (Delhi excise list) are pre-filled in grey and can't be changed here.
 *   - Any other cell is yours: type a price, or clear it to remove that price.
 *   - Add a state by adding a column whose header is the state name, e.g. "Haryana".
 *   - Add a variant/size by adding a row with the Brand key (or Brand), Variant and Size.
 */

export const GRID_SHEET = "Prices by state";
export const GRID_COLS = {
  brand: "Brand",
  variant: "Variant",
  size: "Size",
  category: "Category",
  key: "Brand key (do not edit)",
} as const;

/** Starter rows for brands that have no prices yet. */
const DEFAULT_SIZES: Record<string, number[]> = { beer: [330, 500, 650], wine: [375, 750] };
const DEFAULT_SIZES_OTHER = [180, 375, 750];

export type GridProduct = Pick<ProductDoc, "key" | "state" | "name" | "label" | "brandKey" | "isCurrent"> & {
  sizes: Pick<ProductDoc["sizes"][number], "ml" | "mrp" | "isCurrent">[];
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** "750", "750ml", "750 ML", "1 L", "1 litre", "1.5 Ltr" -> ml + a clean label */
export function parseSize(text: string): { ml: number | null; label: string } {
  const t = text.trim();
  if (!t) return { ml: null, label: "" };
  const s = t.replace(/\s*(litres?|liters?|ltrs?|l)\b\.?/i, " Lt");
  const ml = parseMeasureMl(s);
  return ml ? { ml, label: sizeLabel(ml) } : { ml: null, label: t };
}

const sizePart = (ml: number | null, label: string) => (ml ? String(ml) : norm(label));
const rowKey = (brandKey: string, variant: string, ml: number | null, label: string) => `${brandKey}|${norm(variant)}|${sizePart(ml, label)}`;

type OfficialEntry = { brandKey: string; variant: string; ml: number; prices: Map<string, number> };

/** brand|variant|size -> official price per state (lowest when glass/PET differ). */
function officialIndex(products: GridProduct[], brandNames: Map<string, string>): Map<string, OfficialEntry> {
  const idx = new Map<string, OfficialEntry>();
  for (const p of products) {
    if (!p.brandKey || !p.isCurrent) continue;
    const brandName = brandNames.get(p.brandKey);
    if (!brandName) continue;
    const variant = p.label?.trim() || variantLabel(p.name, brandName);
    for (const s of p.sizes) {
      if (!s.isCurrent) continue;
      const k = rowKey(p.brandKey, variant, s.ml, "");
      const e = idx.get(k) ?? { brandKey: p.brandKey, variant, ml: s.ml, prices: new Map() };
      const prev = e.prices.get(p.state);
      e.prices.set(p.state, prev === undefined ? s.mrp : Math.min(prev, s.mrp));
      idx.set(k, e);
    }
  }
  return idx;
}

const manualKey = (p: Pick<StatePrice, "brandKey" | "state" | "variant" | "ml" | "size">) => `${rowKey(p.brandKey, p.variant, p.ml, p.size)}|${p.state}`;

// ---------------------------------------------------------------- export

const FILL_OFFICIAL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
const FILL_EDIT: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
const FILL_EDIT_HEADER: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } };
const FILL_READONLY_HEADER: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

export function addPriceGridSheet(
  wb: ExcelJS.Workbook,
  { brands, products, statePrices }: { brands: Pick<BrandDoc, "key" | "name" | "category">[]; products: GridProduct[]; statePrices: StatePrice[] },
) {
  const ws = wb.addWorksheet(GRID_SHEET);
  const brandNames = new Map(brands.map((b) => [b.key, b.name]));
  const official = officialIndex(products, brandNames);

  // State columns: automatic sources first (Delhi), then states that already have your prices.
  const manualStates = [...new Set(statePrices.map((p) => p.state))].filter((s) => !STATES.some((x) => x.slug === s)).sort((a, b) => stateName(a).localeCompare(stateName(b)));
  const states = [...STATES.map((s) => s.slug), ...manualStates];

  const headers = [GRID_COLS.brand, GRID_COLS.variant, GRID_COLS.size, ...states.map(stateName), GRID_COLS.category, GRID_COLS.key];
  ws.columns = headers.map((h) => ({ header: h, key: h }));

  type Row = { variant: string; ml: number | null; size: string; official: Map<string, number>; manual: Map<string, number> };
  for (const b of brands) {
    const rows = new Map<string, Row>();
    for (const e of official.values()) {
      if (e.brandKey !== b.key) continue;
      rows.set(rowKey(b.key, e.variant, e.ml, ""), { variant: e.variant, ml: e.ml, size: sizeLabel(e.ml), official: e.prices, manual: new Map() });
    }
    for (const p of statePrices) {
      if (p.brandKey !== b.key) continue;
      const k = rowKey(b.key, p.variant, p.ml, p.size);
      const row = rows.get(k) ?? { variant: p.variant, ml: p.ml, size: p.ml ? sizeLabel(p.ml) : p.size, official: new Map(), manual: new Map() };
      row.manual.set(p.state, p.mrp);
      rows.set(k, row);
    }
    // Brands without official prices always get the starter sizes, so they can be filled in over time.
    const hasOfficial = [...rows.values()].some((r) => r.official.size > 0);
    if (!hasOfficial) {
      for (const ml of DEFAULT_SIZES[b.category] ?? DEFAULT_SIZES_OTHER) {
        const k = rowKey(b.key, "", ml, "");
        if (!rows.has(k)) rows.set(k, { variant: "", ml, size: sizeLabel(ml), official: new Map(), manual: new Map() });
      }
    }
    const sorted = [...rows.values()].sort((a, c) => a.variant.localeCompare(c.variant) || (a.ml ?? 0) - (c.ml ?? 0));
    for (const r of sorted) {
      const values: Record<string, unknown> = { [GRID_COLS.brand]: b.name, [GRID_COLS.variant]: r.variant, [GRID_COLS.size]: r.size, [GRID_COLS.category]: b.category, [GRID_COLS.key]: b.key };
      for (const s of states) values[stateName(s)] = r.official.get(s) ?? r.manual.get(s) ?? null;
      const row = ws.addRow(values);
      row.getCell(GRID_COLS.variant).fill = FILL_EDIT;
      row.getCell(GRID_COLS.size).fill = FILL_EDIT;
      for (const s of states) {
        const cell = row.getCell(stateName(s));
        cell.numFmt = "#,##0";
        if (r.official.has(s)) {
          cell.fill = FILL_OFFICIAL;
          cell.font = { color: { argb: "FF475569" } };
        } else cell.fill = FILL_EDIT;
      }
    }
  }

  // Header styling + help notes on the first state column.
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.height = 30;
  header.alignment = { vertical: "middle", wrapText: true };
  headers.forEach((h, i) => {
    const cell = header.getCell(i + 1);
    const editable = h === GRID_COLS.variant || h === GRID_COLS.size || states.some((s) => stateName(s) === h);
    cell.fill = editable ? FILL_EDIT_HEADER : FILL_READONLY_HEADER;
    ws.getColumn(i + 1).width = h === GRID_COLS.brand ? 26 : h === GRID_COLS.variant ? 34 : h === GRID_COLS.key ? 28 : h === GRID_COLS.size ? 10 : 13;
  });
  header.getCell(GRID_COLS.size).note = "e.g. 180 ml, 750 ml, 1 L, 650 ml";
  header.getCell(stateName(states[0])).note =
    "Grey cells: official price from the excise list (can't be changed here). Yellow cells: your prices. Add a state by adding a column named after it, e.g. Haryana.";
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
}

// ---------------------------------------------------------------- import

export type GridIssue = { sheet: string; row: number; message: string };
export type GridChange = { key: string; brand: string; field: string; from: string; to: string };
export type GridPlan = {
  rows: number;
  creates: StatePrice[];
  updates: { id: string; set: Partial<StatePrice> }[];
  deletes: string[];
  changes: GridChange[];
  errors: GridIssue[];
  warnings: GridIssue[];
};

function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("").trim();
    if ("result" in value) return text(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text).trim();
  }
  return String(value).trim();
}

function parsePrice(t: string): number | null | "invalid" {
  if (!t) return null;
  const n = Number(t.replace(/[₹,\s]|rs\.?/gi, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) return "invalid";
  return Math.round(n * 100) / 100;
}

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function planPriceGrid(
  ws: ExcelJS.Worksheet,
  ctx: { brands: Map<string, string>; products: GridProduct[]; statePrices: StatePrice[] },
): GridPlan {
  const plan: GridPlan = { rows: 0, creates: [], updates: [], deletes: [], changes: [], errors: [], warnings: [] };
  const sheet = GRID_SHEET;
  const now = new Date().toISOString();

  // Map headers: fixed columns + any header that is a state name.
  const fixed = new Map<string, number>();
  const stateCols: { col: number; slug: string; name: string }[] = [];
  const fixedNames = new Set(Object.values(GRID_COLS).map((h) => h.toLowerCase()));
  ws.getRow(1).eachCell((cell, col) => {
    const h = text(cell.value);
    if (!h) return;
    if (fixedNames.has(h.toLowerCase())) return void fixed.set(h.toLowerCase(), col);
    const st = findState(h);
    if (st) {
      if (stateCols.some((s) => s.slug === st.slug)) plan.warnings.push({ sheet, row: 1, message: `"${h}" is a second column for ${st.name}; it is ignored.` });
      else stateCols.push({ col, slug: st.slug, name: st.name });
    } else plan.warnings.push({ sheet, row: 1, message: `Column "${h}" is not a state name, so it is ignored. Use the full state name, e.g. Uttar Pradesh.` });
  });
  const keyCol = fixed.get(GRID_COLS.key.toLowerCase());
  const brandCol = fixed.get(GRID_COLS.brand.toLowerCase());
  const variantCol = fixed.get(GRID_COLS.variant.toLowerCase());
  const sizeCol = fixed.get(GRID_COLS.size.toLowerCase());
  if ((!keyCol && !brandCol) || !sizeCol) {
    plan.errors.push({ sheet, row: 1, message: `The sheet needs "${GRID_COLS.key}" (or "${GRID_COLS.brand}") and "${GRID_COLS.size}" columns.` });
    return plan;
  }

  const brandNames = ctx.brands;
  const byName = new Map<string, string[]>();
  for (const [k, n] of brandNames) byName.set(n.toLowerCase(), [...(byName.get(n.toLowerCase()) ?? []), k]);
  const official = officialIndex(ctx.products, brandNames);
  const manual = new Map(ctx.statePrices.map((p) => [manualKey(p), p]));

  // Last row wins when the same brand/variant/size/state appears twice.
  type Action = { row: number; brandKey: string; state: string; stateLabel: string; variant: string; size: string; ml: number | null; price: number | null };
  const actions = new Map<string, Action>();

  ws.eachRow((row, r) => {
    if (r === 1) return;
    const get = (col?: number) => (col ? text(row.getCell(col).value) : "");
    let brandKey = get(keyCol);
    const brandText = get(brandCol);
    if (!brandKey && !brandText) return;
    plan.rows++;
    const err = (message: string) => plan.errors.push({ sheet, row: r, message });
    if (!brandKey) {
      const keys = byName.get(brandText.toLowerCase()) ?? [];
      if (keys.length !== 1) return void err(keys.length ? `"${brandText}" exists in several categories; fill in the Brand key.` : `Unknown brand "${brandText}". Copy the Brand key from the Brands sheet.`);
      brandKey = keys[0];
    }
    if (!brandNames.has(brandKey)) return void err(`Unknown brand key "${brandKey}".`);
    const variant = get(variantCol).slice(0, 200);
    const sizeText = get(sizeCol);
    const { ml, label } = parseSize(sizeText);
    const hasAnyPrice = stateCols.some((s) => get(s.col));
    if (!label && hasAnyPrice) return void err("Size is required when a price is entered (e.g. 750 ml).");

    for (const s of stateCols) {
      const cellText = get(s.col);
      const off = official.get(rowKey(brandKey, variant, ml, label))?.prices.get(s.slug);
      if (off !== undefined) {
        const typed = parsePrice(cellText);
        if (cellText && typed !== off)
          plan.warnings.push({ sheet, row: r, message: `${s.name} ${variant} ${label}: the official price ${money(off)} is kept (official prices can't be changed here).` });
        continue;
      }
      const price = parsePrice(cellText);
      if (price === "invalid") {
        err(`${s.name}: "${cellText}" is not a valid price.`);
        continue;
      }
      const k = `${rowKey(brandKey, variant, ml, label)}|${s.slug}`;
      if (actions.has(k)) plan.warnings.push({ sheet, row: r, message: `${brandNames.get(brandKey)} ${variant} ${label} ${s.name} appears twice; the last row is used.` });
      actions.set(k, { row: r, brandKey, state: s.slug, stateLabel: s.name, variant, size: label, ml, price });
    }
  });

  for (const [k, a] of actions) {
    const existing = manual.get(k);
    const what = `${a.variant ? `${a.variant} ` : ""}${a.size}`.trim();
    const brand = brandNames.get(a.brandKey)!;
    if (a.price === null) {
      if (!existing) continue;
      plan.deletes.push(existing.id);
      plan.changes.push({ key: a.brandKey, brand, field: `${a.stateLabel} price removed`, from: `${what} ${money(existing.mrp)}`, to: "(blank)" });
    } else if (existing) {
      if (existing.mrp === a.price) continue;
      plan.updates.push({ id: existing.id, set: { mrp: a.price, variant: a.variant, size: a.size, ml: a.ml, updatedAt: now } });
      plan.changes.push({ key: a.brandKey, brand, field: `${a.stateLabel} price`, from: `${what} ${money(existing.mrp)}`, to: `${what} ${money(a.price)}` });
    } else {
      plan.creates.push({ id: randomUUID(), brandKey: a.brandKey, state: a.state, variant: a.variant, size: a.size, ml: a.ml, mrp: a.price, note: "", updatedAt: now });
      plan.changes.push({ key: a.brandKey, brand, field: `New ${a.stateLabel} price`, from: "", to: `${what} ${money(a.price)}` });
    }
  }
  return plan;
}
