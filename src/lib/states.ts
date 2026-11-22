import { slugify } from "./normalize";

/** Indian states and union territories, for state-wise price tables. */
export const INDIAN_STATES: { slug: string; name: string; aliases?: string[] }[] = [
  { slug: "andhra-pradesh", name: "Andhra Pradesh", aliases: ["ap"] },
  { slug: "arunachal-pradesh", name: "Arunachal Pradesh" },
  { slug: "assam", name: "Assam" },
  { slug: "bihar", name: "Bihar" },
  { slug: "chhattisgarh", name: "Chhattisgarh", aliases: ["chattisgarh"] },
  { slug: "goa", name: "Goa" },
  { slug: "gujarat", name: "Gujarat" },
  { slug: "haryana", name: "Haryana" },
  { slug: "himachal-pradesh", name: "Himachal Pradesh", aliases: ["hp"] },
  { slug: "jharkhand", name: "Jharkhand" },
  { slug: "karnataka", name: "Karnataka", aliases: ["bangalore", "bengaluru"] },
  { slug: "kerala", name: "Kerala" },
  { slug: "madhya-pradesh", name: "Madhya Pradesh", aliases: ["mp"] },
  { slug: "maharashtra", name: "Maharashtra", aliases: ["mumbai", "pune"] },
  { slug: "manipur", name: "Manipur" },
  { slug: "meghalaya", name: "Meghalaya" },
  { slug: "mizoram", name: "Mizoram" },
  { slug: "nagaland", name: "Nagaland" },
  { slug: "odisha", name: "Odisha", aliases: ["orissa"] },
  { slug: "punjab", name: "Punjab" },
  { slug: "rajasthan", name: "Rajasthan" },
  { slug: "sikkim", name: "Sikkim" },
  { slug: "tamil-nadu", name: "Tamil Nadu", aliases: ["tn", "chennai"] },
  { slug: "telangana", name: "Telangana", aliases: ["hyderabad"] },
  { slug: "tripura", name: "Tripura" },
  { slug: "uttar-pradesh", name: "Uttar Pradesh", aliases: ["up", "noida", "lucknow"] },
  { slug: "uttarakhand", name: "Uttarakhand", aliases: ["uttrakhand"] },
  { slug: "west-bengal", name: "West Bengal", aliases: ["wb", "kolkata"] },
  { slug: "andaman-and-nicobar-islands", name: "Andaman and Nicobar Islands", aliases: ["andaman"] },
  { slug: "chandigarh", name: "Chandigarh" },
  { slug: "dadra-and-nagar-haveli-and-daman-and-diu", name: "Dadra and Nagar Haveli and Daman and Diu", aliases: ["daman", "diu", "daman and diu", "dadra and nagar haveli"] },
  { slug: "delhi", name: "Delhi", aliases: ["nct of delhi", "new delhi"] },
  { slug: "jammu-and-kashmir", name: "Jammu and Kashmir", aliases: ["j&k", "jk"] },
  { slug: "ladakh", name: "Ladakh" },
  { slug: "lakshadweep", name: "Lakshadweep" },
  { slug: "puducherry", name: "Puducherry", aliases: ["pondicherry"] },
];

const BY_SLUG = new Map(INDIAN_STATES.map((s) => [s.slug, s]));

export function stateName(slug: string): string {
  return BY_SLUG.get(slug)?.name ?? slug;
}

/** Resolve whatever was typed in Excel ("Delhi", "NCT of Delhi", "maharashtra") to a state slug. */
export function findState(text: string): { slug: string; name: string } | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  const slug = slugify(t);
  return INDIAN_STATES.find((s) => s.slug === slug || s.name.toLowerCase() === t || s.aliases?.includes(t));
}
