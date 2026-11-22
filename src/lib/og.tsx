import { ImageResponse } from "next/og";
import { SITE_NAME } from "./config";

/** Share-image size used by Facebook, WhatsApp, LinkedIn and X. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const NAVY = "#0d2037";
const GOLD = "#f2bd16";

/** Price text for share images: "Rs 400 - Rs 1,200" (the bundled font has no rupee sign). */
export function ogPrice(text: string): string {
  return text.replace(/₹\s?/g, "Rs ").replace(/\s*[–—]\s*/g, " - ");
}

/**
 * Branded 1200×630 share card: site name, a kicker line, a big title and an optional subtitle.
 * Rendered at build time and cached (no runtime cost).
 */
export function ogCard({ kicker, title, subtitle, badge }: { kicker?: string; title: string; subtitle?: string; badge?: string }) {
  const [first, ...rest] = SITE_NAME.split(" ");
  const titleSize = title.length > 48 ? 58 : title.length > 30 ? 70 : 84;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: `linear-gradient(115deg, ${NAVY} 0%, #173257 100%)`, color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 512 512">
            <rect width="512" height="512" rx="112" fill="#ffffff" fillOpacity="0.08" />
            <path d="M132 112h248l-30 284a36 36 0 0 1-36 32H198a36 36 0 0 1-36-32z" fill="none" stroke={GOLD} strokeWidth="30" strokeLinejoin="round" />
            <path d="M164 250h184l-16 140a18 18 0 0 1-18 16H198a18 18 0 0 1-18-16z" fill={GOLD} />
          </svg>
          <div style={{ display: "flex", fontSize: 36, letterSpacing: -0.5 }}>
            <span>{first}&nbsp;</span>
            <span style={{ color: GOLD }}>{rest.join(" ")}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {kicker && <div style={{ fontSize: 30, color: GOLD, marginBottom: 18, textTransform: "uppercase", letterSpacing: 3 }}>{kicker}</div>}
          <div style={{ fontSize: titleSize, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1050 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 34, color: "#d4dce6", marginTop: 22, maxWidth: 1000 }}>{subtitle}</div>}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 26, color: "#b8c4d3" }}>
          <span>Liquor prices · Laws · Dry days · India</span>
          {badge && <span style={{ background: GOLD, color: NAVY, padding: "10px 22px", borderRadius: 999, fontSize: 30 }}>{badge}</span>}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
