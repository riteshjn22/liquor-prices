import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";
import { CATEGORIES } from "@/lib/categories";
import { buildWorkbook } from "@/lib/excel";
import { COLLECTIONS, getDb } from "@/lib/mongodb";
import type { BrandDoc, ProductDoc, StatePrice } from "@/lib/types";

export const maxDuration = 60;

/** Download brands, state prices and Delhi product assignments as one editable Excel file. */
export async function GET(request: Request) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();

  const db = await getDb();
  const [brands, statePrices, products] = await Promise.all([
    db.collection<BrandDoc>(COLLECTIONS.brands).find({}, { projection: { _id: 0 } }).collation({ locale: "en" }).sort({ category: 1, name: 1 }).toArray(),
    db.collection<StatePrice>(COLLECTIONS.statePrices).find({}, { projection: { _id: 0 } }).toArray(),
    db
      .collection<ProductDoc>(COLLECTIONS.products)
      .find(
        { typeSlug: { $in: CATEGORIES.flatMap((c) => c.exciseTypes) } },
        { projection: { _id: 0, key: 1, name: 1, typeName: 1, typeSlug: 1, isCurrent: 1, brandKey: 1, autoBrandKey: 1, brandOverride: 1, label: 1, "sizes.label": 1, "sizes.mrp": 1, "sizes.isCurrent": 1 } },
      )
      .toArray(),
  ]);

  const file = await buildWorkbook({
    brands: brands as BrandDoc[],
    statePrices: statePrices as StatePrice[],
    products: products as unknown as ProductDoc[],
  });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liquor-brands-${date}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
