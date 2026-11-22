/**
 * Site categories. Each maps to one or more excise "types" from the state lists
 * (Delhi splits beer into light / strong / draught, etc.) and to the sheet names
 * used in brand-list Excel files ("Whiskies", "Beers", ...).
 * To add a category (e.g. gin), add an entry here.
 */
export type Category = {
  slug: string;
  name: string;
  plural: string;
  emoji: string;
  exciseTypes: string[];
  sheetNames: string[];
  blurb: string;
};

export const CATEGORIES: Category[] = [
  {
    slug: "whisky",
    name: "Whisky",
    plural: "Whiskies",
    emoji: "🥃",
    exciseTypes: ["whisky"],
    sheetNames: ["whisky", "whiskies", "whiskey", "whiskeys"],
    blurb: "Explore whisky brands, variants and bottle-size prices.",
  },
  {
    slug: "beer",
    name: "Beer",
    plural: "Beers",
    emoji: "🍺",
    exciseTypes: ["beer-light", "beer-strong", "draught-beer"],
    sheetNames: ["beer", "beers"],
    blurb: "Browse beer brands and pack-size prices.",
  },
  {
    slug: "wine",
    name: "Wine",
    plural: "Wines",
    emoji: "🍷",
    exciseTypes: ["wine", "champagne"],
    sheetNames: ["wine", "wines"],
    blurb: "Find wine brands, varieties and available prices.",
  },
  {
    slug: "vodka",
    name: "Vodka",
    plural: "Vodkas",
    emoji: "🍸",
    exciseTypes: ["vodka"],
    sheetNames: ["vodka", "vodkas"],
    blurb: "Browse vodka brands and bottle-size prices.",
  },
  {
    slug: "rum",
    name: "Rum",
    plural: "Rums",
    emoji: "🥃",
    exciseTypes: ["rum"],
    sheetNames: ["rum", "rums"],
    blurb: "Explore rum brands, variants and prices.",
  },
  {
    slug: "brandy",
    name: "Brandy",
    plural: "Brandies",
    emoji: "🍷",
    exciseTypes: ["brandy", "cognac"],
    sheetNames: ["brandy", "brandies", "cognac"],
    blurb: "Find brandy and cognac brands and bottle-size prices.",
  },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** "beer-strong" -> "beer" */
export function categoryForExciseType(typeSlug: string): Category | undefined {
  return CATEGORIES.find((c) => c.exciseTypes.includes(typeSlug));
}

/** "Rums " / "Whiskies" sheet name -> category */
export function categoryForSheet(sheetName: string): Category | undefined {
  const n = sheetName.trim().toLowerCase();
  return CATEGORIES.find((c) => c.sheetNames.includes(n) || c.slug === n);
}

/** Accepts "Whisky", "whisky", "Whiskies" */
export function categoryFromText(text: string): Category | undefined {
  return getCategory(text.trim().toLowerCase()) ?? categoryForSheet(text);
}
