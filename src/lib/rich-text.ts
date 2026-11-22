import sanitizeHtml from "sanitize-html";

/**
 * Editor content (admin editor or an Excel cell) is stored as HTML.
 * Everything is cleaned with an allowlist before it is saved, so pasted
 * scripts, styles, event handlers or iframes can never reach the site.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "hr", "img", "table", "thead", "tbody", "tr", "th", "td"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  transformTags: {
    // Editors often produce h1; the page already has one, so demote it.
    h1: "h2",
    // External links open in a new tab and don't pass ranking signals by default.
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href);
      const out: sanitizeHtml.Attributes = external ? { href, target: "_blank", rel: "noopener nofollow" } : { href };
      return { tagName, attribs: out };
    },
  },
  exclusiveFilter: (frame) => frame.tag === "p" && !frame.text.trim() && !frame.mediaChildren?.length,
};

export function cleanHtml(html: string): string {
  return sanitizeHtml(html ?? "", OPTIONS).trim();
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain text (e.g. typed in Excel) -> paragraphs; a single line break becomes <br>. */
export function textToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Accept either HTML (from the editor or pasted) or plain text, and return safe HTML. */
export function toSafeHtml(input: string | null | undefined): string {
  const v = (input ?? "").trim();
  if (!v) return "";
  return cleanHtml(/<\/?[a-z][\s\S]*>/i.test(v) ? v : textToHtml(v));
}

/** True when the content has no visible text or images (e.g. an empty editor gives "<p></p>"). */
export function isEmptyHtml(html: string | null | undefined): boolean {
  return !html || !/<img\b/i.test(html) && !html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
