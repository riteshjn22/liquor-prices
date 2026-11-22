import type { HomeCard, PillColor } from "./types";

/** Label colours an admin can pick for a blog category (full class names so Tailwind keeps them). */
export const PILL_COLORS: Record<PillColor, { label: string; className: string }> = {
  red: { label: "Red", className: "bg-red-100 text-red-700" },
  blue: { label: "Blue", className: "bg-blue-100 text-blue-700" },
  green: { label: "Green", className: "bg-green-100 text-green-700" },
  amber: { label: "Yellow", className: "bg-amber-100 text-amber-800" },
  purple: { label: "Purple", className: "bg-purple-100 text-purple-700" },
  gray: { label: "Grey", className: "bg-slate-200 text-slate-700" },
};

export function isPillColor(v: unknown): v is PillColor {
  return typeof v === "string" && v in PILL_COLORS;
}

/** Post slugs that would clash with blog routes. */
export const RESERVED_POST_SLUGS = new Set(["category"]);

/**
 * Home page "Explore Information" cards. Titles, text and links are edited in the admin
 * (Pages tab); the icon stays with the card.
 */
export const DEFAULT_HOME_CARDS: HomeCard[] = [
  { id: "dry-days", title: "Dry Days", subtitle: "Calendars and closures", href: "/blog" },
  { id: "laws", title: "Laws & Rules", subtitle: "Legal information", href: "/law" },
  { id: "prices", title: "Price Information", subtitle: "Brand-wise MRP data", href: "/prices" },
  { id: "awareness", title: "Awareness", subtitle: "Alcohol awareness information", href: "/blog" },
];

/** A link typed in the admin: a path on this site ("/blog/x") or an https:// address. */
export function isValidLink(href: string): boolean {
  return /^\/[^\s]*$/.test(href) || /^https:\/\/[^\s]+$/.test(href);
}

/** Saved cards merged over the defaults, so a missing or broken field never breaks the page. */
export function mergeHomeCards(saved: Partial<HomeCard>[] | null | undefined): HomeCard[] {
  return DEFAULT_HOME_CARDS.map((d) => {
    const s = saved?.find((c) => c.id === d.id);
    return {
      id: d.id,
      title: s?.title?.trim() || d.title,
      subtitle: s?.subtitle?.trim() ?? d.subtitle,
      href: s?.href && isValidLink(s.href) ? s.href : d.href,
    };
  });
}
