import type { NextRequest } from "next/server";
import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";
import { buildWorkbook } from "@/lib/excel";
import { COLLECTIONS, getDb } from "@/lib/mongodb";
import type { BrandDoc } from "@/lib/types";

export const maxDuration = 60;

/** Download every brand (and every size) as an editable Excel file. ?state=delhi to limit to one state. */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();

  const state = request.nextUrl.searchParams.get("state");
  const db = await getDb();
  const docs = await db
    .collection<BrandDoc>(COLLECTIONS.brands)
    .find(state ? { state } : {}, { projection: { _id: 0, rawNames: 0, suppliers: 0, origins: 0, "sizes.history": 0 } })
    .sort({ state: 1, typeSlug: 1, name: 1 })
    .toArray();

  const file = await buildWorkbook(docs as BrandDoc[]);
  const date = new Date().toISOString().slice(0, 10);
  const name = `liquor-prices-${state ?? "all"}-${date}.xlsx`;
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
