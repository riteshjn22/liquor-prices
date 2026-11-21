import { revalidateTag } from "next/cache";
import { PRICES_TAG } from "@/lib/config";

/**
 * Refresh every cached price page. Used when the sync runs outside Vercel
 * (`npm run sync` locally or the GitHub Actions workflow), or after you
 * change brand images in the database.
 *   curl -X POST -H "Authorization: Bearer $REVALIDATE_SECRET" https://your-site/api/revalidate
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  revalidateTag(PRICES_TAG, "max");
  return Response.json({ revalidated: true });
}
