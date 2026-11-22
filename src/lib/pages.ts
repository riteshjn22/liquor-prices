import { CATEGORIES, getCategory } from "./categories";

/** Page sections whose text is written in the admin editor (or the Excel "Page content" sheet). */
export type ContentSlot = { key: string; label: string; url: string; hasTitle?: boolean; fallback: string };

export function contentSlots(): ContentSlot[] {
  return [
    {
      key: "prices:about",
      label: "Liquor prices page: About section",
      url: "/prices",
      fallback: "Hidden until you write it.",
    },
    ...CATEGORIES.map((c) => ({
      key: `category:${c.slug}:about`,
      label: `${c.name} prices page: About section`,
      url: `/prices/${c.slug}`,
      fallback: "Shows a standard paragraph until you write it.",
    })),
    {
      key: "law:body",
      label: "Law page: content",
      url: "/law",
      hasTitle: true,
      fallback: "Shows a 'coming soon' note until you write it.",
    },
  ];
}

export function isContentSlot(key: string): boolean {
  return contentSlots().some((s) => s.key === key);
}

/** Pages that can have FAQs. Brands and blog posts are added by key: "brand:<category>/<slug>", "post:<slug>". */
export function fixedFaqPages(): { page: string; label: string; url: string }[] {
  return [
    { page: "home", label: "Home page", url: "/" },
    { page: "prices", label: "Liquor prices page", url: "/prices" },
    ...CATEGORIES.map((c) => ({ page: `category:${c.slug}`, label: `${c.name} prices page`, url: `/prices/${c.slug}` })),
    { page: "law", label: "Law page", url: "/law" },
    { page: "blog", label: "Blog list page", url: "/blog" },
  ];
}

/** "brand:rum/old-monk" / "post:my-slug" / fixed pages -> is this a valid FAQ page key? */
export function isFaqPage(page: string): boolean {
  if (fixedFaqPages().some((p) => p.page === page)) return true;
  if (/^brand:[a-z0-9-]+\/[a-z0-9-]+$/.test(page)) return !!getCategory(page.slice(6).split("/")[0]);
  return /^post:[a-z0-9-]+$/.test(page);
}
