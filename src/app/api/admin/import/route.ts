import { revalidateTag } from "next/cache";
import type { AnyBulkWriteOperation } from "mongodb";
import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";
import { assignBrands } from "@/lib/brand-match";
import { PRICES_TAG } from "@/lib/config";
import { planImport, type ImportContext } from "@/lib/excel";
import { COLLECTIONS, ensureIndexes, getDb } from "@/lib/mongodb";
import type { BlogPost, BrandDoc, FaqDoc, PageContent, ProductDoc, StatePrice } from "@/lib/types";

export const maxDuration = 60;

// Vercel rejects request bodies over 4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024;

/** Split a partial document into $set (values) and $unset (cleared fields). */
function setUnset<T extends object>(set: Partial<T>) {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};
  for (const [k, v] of Object.entries(set)) {
    if (v === undefined) $unset[k] = "";
    else $set[k] = v;
  }
  return { $set, $unset };
}

/**
 * Upload an edited Excel file (or a plain brand list).
 *   mode=preview -> list what would change (nothing is saved)
 *   mode=apply   -> save, re-match Delhi products to brands, refresh the site
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const mode = form?.get("mode") === "apply" ? "apply" : "preview";
  // "Full brand list": brands not in the file are switched off.
  const fullList = form?.get("fullList") === "1";
  if (!(file instanceof File)) return Response.json({ error: "Choose an .xlsx file to upload." }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return Response.json({ error: "Only .xlsx files are supported (Excel > Save As > Excel Workbook)." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File is larger than 4 MB. Delete rows you did not change and try again." }, { status: 413 });

  const db = await getDb();
  await ensureIndexes(db);
  const [brands, statePrices, products, pageContent, faqs, posts] = await Promise.all([
    db.collection<BrandDoc>(COLLECTIONS.brands).find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<StatePrice>(COLLECTIONS.statePrices).find({}, { projection: { _id: 0 } }).toArray(),
    db
      .collection<ProductDoc>(COLLECTIONS.products)
      .find({}, { projection: { _id: 0, key: 1, state: 1, name: 1, brandKey: 1, isCurrent: 1, brandOverride: 1, label: 1, "sizes.ml": 1, "sizes.mrp": 1, "sizes.isCurrent": 1 } })
      .toArray(),
    db.collection<PageContent>(COLLECTIONS.pageContent).find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<FaqDoc>(COLLECTIONS.faqs).find({}, { projection: { _id: 0, page: 1, items: 1 } }).toArray(),
    db.collection<BlogPost>(COLLECTIONS.posts).find({}, { projection: { _id: 0, slug: 1 } }).toArray(),
  ]);
  const ctx: ImportContext = {
    brands: brands as BrandDoc[],
    statePrices: statePrices as StatePrice[],
    products: products as unknown as ImportContext["products"],
    pageContent: pageContent as PageContent[],
    faqs: faqs as FaqDoc[],
    postSlugs: posts.map((p) => p.slug),
  };

  let plan;
  try {
    plan = await planImport(await file.arrayBuffer(), ctx, { fullList });
  } catch (err) {
    return Response.json({ error: `Could not read the file as Excel: ${(err as Error).message}` }, { status: 400 });
  }

  const writes = plan.brandWrites.length + plan.priceCreates.length + plan.priceUpdates.length + plan.priceDeletes.length + plan.productWrites.length + plan.pageWrites.length + plan.faqWrites.length;
  const summary = {
    mode,
    fileName: file.name,
    format: plan.format,
    fullList,
    rows: plan.rows,
    newBrands: plan.brandWrites.filter((w) => w.isNew).length,
    totalChanges: plan.changes.length,
    changes: plan.changes.slice(0, 500),
    errors: plan.errors.slice(0, 200),
    totalErrors: plan.errors.length,
    warnings: plan.warnings.slice(0, 100),
    applied: false,
  };

  if (mode === "apply" && plan.errors.length) {
    return Response.json({ ...summary, error: "Nothing was saved. Fix the errors in Excel and upload again." }, { status: 422 });
  }
  if (mode === "preview" || writes === 0) return Response.json(summary);

  const now = new Date().toISOString();
  if (plan.brandWrites.length) {
    const ops: AnyBulkWriteOperation<BrandDoc>[] = plan.brandWrites.map((w) => {
      const { $set, $unset } = setUnset<BrandDoc>(w.set);
      const { createdAt, ...rest } = $set;
      return {
        updateOne: {
          filter: { key: w.key },
          update: {
            $set: { ...rest, updatedAt: now },
            ...(w.isNew ? { $setOnInsert: { createdAt: (createdAt as string) ?? now } } : {}),
            ...(Object.keys($unset).length ? { $unset } : {}),
          },
          upsert: w.isNew,
        },
      };
    });
    await db.collection<BrandDoc>(COLLECTIONS.brands).bulkWrite(ops, { ordered: false });
  }
  const prices = db.collection<StatePrice>(COLLECTIONS.statePrices);
  if (plan.priceCreates.length) await prices.insertMany(plan.priceCreates);
  if (plan.priceUpdates.length) await prices.bulkWrite(plan.priceUpdates.map((u) => ({ updateOne: { filter: { id: u.id }, update: { $set: u.set } } })), { ordered: false });
  if (plan.priceDeletes.length) await prices.deleteMany({ id: { $in: plan.priceDeletes } });
  if (plan.productWrites.length) {
    await db
      .collection<ProductDoc>(COLLECTIONS.products)
      .bulkWrite(plan.productWrites.map((w) => ({ updateOne: { filter: { key: w.key }, update: { $set: w.set } } })), { ordered: false });
  }
  for (const p of plan.pageWrites) {
    const pages = db.collection<PageContent>(COLLECTIONS.pageContent);
    if (!p.html && !p.title) await pages.deleteOne({ key: p.key });
    else await pages.updateOne({ key: p.key }, { $set: { key: p.key, html: p.html, title: p.title, updatedAt: now } }, { upsert: true });
  }
  const faqCol = db.collection<FaqDoc>(COLLECTIONS.faqs);
  for (const f of plan.faqWrites) {
    if (!f.items.length) await faqCol.deleteOne({ page: f.page });
    else await faqCol.updateOne({ page: f.page }, { $set: { page: f.page, items: f.items, updatedAt: now } }, { upsert: true });
  }
  // New brands, renamed brands, match words or manual assignments can all change which products belong where.
  const match = await assignBrands(db);
  await db.collection(COLLECTIONS.imports).insertOne({ at: now, fileName: file.name, format: plan.format, changes: plan.changes.length });

  revalidateTag(PRICES_TAG, { expire: 0 });
  return Response.json({ ...summary, applied: true, productsMatched: match.matched });
}
