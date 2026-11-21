import { revalidateTag } from "next/cache";
import type { AnyBulkWriteOperation } from "mongodb";
import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";
import { PRICES_TAG } from "@/lib/config";
import { planImport } from "@/lib/excel";
import { COLLECTIONS, getDb } from "@/lib/mongodb";
import { applyOverrides } from "@/lib/overrides";
import type { BrandDoc } from "@/lib/types";

export const maxDuration = 60;

// Vercel rejects request bodies over 4.5 MB; a full export is well under that.
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Upload an edited Excel file.
 *   mode=preview -> list what would change (nothing is saved)
 *   mode=apply   -> save the changes and refresh the site
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const mode = form?.get("mode") === "apply" ? "apply" : "preview";
  if (!(file instanceof File)) return Response.json({ error: "Choose an .xlsx file to upload." }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return Response.json({ error: "Only .xlsx files are supported (Excel > Save As > Excel Workbook)." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File is larger than 4 MB. Delete rows you did not change and try again." }, { status: 413 });

  const db = await getDb();
  const brands = db.collection<BrandDoc>(COLLECTIONS.brands);
  const existing = (await brands
    .find({}, { projection: { _id: 0, key: 1, name: 1, officialName: 1, image: 1, overrides: 1, "sizes.key": 1, "sizes.label": 1, "sizes.packageType": 1 } })
    .toArray()) as unknown as Parameters<typeof planImport>[1];

  let plan;
  try {
    plan = await planImport(await file.arrayBuffer(), existing);
  } catch (err) {
    return Response.json({ error: `Could not read the file as Excel: ${(err as Error).message}` }, { status: 400 });
  }

  const summary = {
    mode,
    fileName: file.name,
    brandRows: plan.brandRows,
    priceRows: plan.priceRows,
    brandsChanged: plan.updates.size,
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
  if (mode === "preview" || plan.updates.size === 0) return Response.json(summary);

  // Recompute the effective name/prices from each brand's official data + new overrides.
  const keys = [...plan.updates.keys()];
  const docs = (await brands
    .find({ key: { $in: keys } }, { projection: { _id: 0, key: 1, name: 1, officialName: 1, sizes: 1, refSize: 1, refKey: 1, refMrp: 1 } })
    .toArray()) as unknown as BrandDoc[];
  const now = new Date().toISOString();
  const ops: AnyBulkWriteOperation<BrandDoc>[] = docs.map((doc) => {
    const { overrides, image } = plan.updates.get(doc.key)!;
    const effective = applyOverrides(doc, overrides);
    return {
      updateOne: {
        filter: { key: doc.key },
        update: overrides
          ? { $set: { ...effective, overrides, image, editedAt: now } }
          : { $set: { ...effective, image, editedAt: now }, $unset: { overrides: "" } },
      },
    };
  });
  await brands.bulkWrite(ops, { ordered: false });
  await db.collection(COLLECTIONS.imports).insertOne({
    at: now,
    fileName: file.name,
    brandsChanged: plan.updates.size,
    changes: plan.changes.length,
  });

  // Expire cached pages now so the edits show on the next visit.
  revalidateTag(PRICES_TAG, { expire: 0 });
  return Response.json({ ...summary, applied: true });
}
