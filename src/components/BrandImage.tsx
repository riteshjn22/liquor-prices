import { imageKitEnabled, imageKitUrl } from "@/lib/imagekit";

const TYPE_COLORS: Record<string, string> = {
  whisky: "#b45309",
  rum: "#7c2d12",
  vodka: "#0369a1",
  gin: "#0f766e",
  wine: "#9f1239",
  champagne: "#a16207",
  "beer-light": "#ca8a04",
  "beer-strong": "#a16207",
  "draught-beer": "#854d0e",
  brandy: "#9a3412",
  cognac: "#78350f",
  tequila: "#65a30d",
  liqueur: "#7e22ce",
  alcopop: "#db2777",
  "mixed-alcoholic-beverages": "#4f46e5",
  "country-liquor": "#57534e",
};

type Props = {
  image?: string | null;
  name: string;
  typeSlug: string;
  size?: number;
  priority?: boolean;
  className?: string;
};

/** ImageKit photo when one is linked, otherwise a lightweight inline bottle illustration. */
export function BrandImage({ image, name, typeSlug, size = 160, priority = false, className = "" }: Props) {
  if (image && imageKitEnabled) {
    return (
      // Plain <img>: ImageKit already resizes/compresses, so we skip Vercel's image optimiser quota.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageKitUrl(image, size, size)}
        srcSet={`${imageKitUrl(image, size, size)} 1x, ${imageKitUrl(image, size * 2, size * 2)} 2x`}
        width={size}
        height={size}
        alt={`${name} bottle`}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={`object-contain ${className}`}
      />
    );
  }

  const color = TYPE_COLORS[typeSlug] ?? "#475569";
  const isCan = typeSlug.includes("beer");
  return (
    <svg
      role="img"
      aria-label={`${name} illustration`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
    >
      <rect width="100" height="100" rx="14" fill={color} opacity="0.08" />
      {isCan ? (
        <g>
          <rect x="34" y="24" width="32" height="56" rx="6" fill={color} opacity="0.85" />
          <rect x="36" y="20" width="28" height="6" rx="3" fill={color} />
          <rect x="34" y="42" width="32" height="18" fill="#fff" opacity="0.85" />
        </g>
      ) : (
        <g>
          <rect x="45" y="12" width="10" height="16" rx="2" fill={color} />
          <path d="M45 28 C45 36 34 38 34 48 L34 84 Q34 88 38 88 L62 88 Q66 88 66 84 L66 48 C66 38 55 36 55 28 Z" fill={color} opacity="0.85" />
          <rect x="37" y="54" width="26" height="20" rx="2" fill="#fff" opacity="0.85" />
        </g>
      )}
    </svg>
  );
}
