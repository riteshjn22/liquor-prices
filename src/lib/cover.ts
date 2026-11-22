import { imageKitEnabled, imageKitUrl } from "./imagekit";

/** Blog cover image: an ImageKit path ("/blog/x.jpg") is resized by ImageKit; an https URL is used as is. */
export function coverUrl(cover: string, width: number, height?: number): string | null {
  if (!cover) return null;
  if (/^https:\/\//.test(cover)) return cover;
  if (cover.startsWith("/") && imageKitEnabled) return imageKitUrl(cover, width, height);
  return null;
}
