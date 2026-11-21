const ENDPOINT = (process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "").replace(/\/+$/, "");

export const imageKitEnabled = ENDPOINT.length > 0;

/**
 * Build an ImageKit URL with on-the-fly resizing.
 * path: "/brands/whisky/old-monk.jpg" (as stored on the brand document)
 */
export function imageKitUrl(path: string, width: number, height?: number): string {
  const tr = [`w-${width}`, height ? `h-${height}` : null, "c-at_max", "f-auto", "q-80"].filter(Boolean).join(",");
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${ENDPOINT}/tr:${tr}${clean}`;
}

/** Conventional upload location for a brand image (see scripts/link-images.ts). */
export function brandImageFolder(state: string, typeSlug: string): string {
  return `/brands/${state}/${typeSlug}`;
}
