import sanitizeHtml from "sanitize-html";

/**
 * Editor content (admin editor or an Excel cell) is stored as HTML.
 *
 * Allowed: all normal content and layout HTML (headings 1-6, div/span/section, tables, figures,
 * lists, pre/code, sup/sub, details/summary, images, video, audio), plus class, id and safe
 * inline styles, and embeds from YouTube, Vimeo and Google Maps.
 *
 * Always removed, because it would let anyone who gets HTML into the site run code in
 * visitors' browsers: <script>, <style>, <iframe> from other sites, <object>/<embed>, forms,
 * on* event handlers (onclick, onerror…), javascript: links and CSS url()/expression().
 */
const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags, // address, article, aside, footer, header, h1-h6, section, blockquote, div, dl/dt/dd, figure, figcaption, hr, li, ol, p, pre, ul, a, abbr, b, br, cite, code, em, i, kbd, mark, q, s, small, span, strong, sub, sup, time, u, caption, col, colgroup, table, tbody, td, tfoot, th, thead, tr, …
  "img",
  "picture",
  "source",
  "video",
  "audio",
  "track",
  "iframe",
  "details",
  "summary",
  "del",
  "ins",
  "center",
  "font",
  "big",
  "strike",
];

const GLOBAL_ATTRS = ["class", "id", "style", "title", "lang", "dir", "align", "valign", "role", "aria-label", "aria-hidden", "data-*"];

const SAFE_CSS_VALUE = /^(?!.*(?:url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:))[^<>{};]*$/i;
const CSS_PROPS = [
  "color", "background", "background-color", "text-align", "text-decoration", "text-transform", "text-indent",
  "font", "font-size", "font-weight", "font-style", "font-family", "line-height", "letter-spacing", "white-space",
  "vertical-align", "width", "min-width", "max-width", "height", "min-height", "max-height",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-color", "border-width", "border-style",
  "border-radius", "border-collapse", "border-spacing", "float", "clear", "display", "list-style", "list-style-type",
  "object-fit", "aspect-ratio", "gap", "flex", "flex-direction", "flex-wrap", "justify-content", "align-items",
  "grid-template-columns", "opacity", "overflow", "box-sizing", "table-layout",
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    "*": GLOBAL_ATTRS,
    a: ["href", "name", "target", "rel"],
    img: ["src", "srcset", "sizes", "alt", "width", "height", "loading", "decoding"],
    source: ["src", "srcset", "type", "media", "sizes"],
    video: ["src", "poster", "width", "height", "controls", "autoplay", "muted", "loop", "playsinline", "preload"],
    audio: ["src", "controls", "autoplay", "muted", "loop", "preload"],
    track: ["src", "kind", "srclang", "label", "default"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "loading", "referrerpolicy"],
    table: ["border", "cellpadding", "cellspacing", "width", "summary"],
    td: ["colspan", "rowspan", "width", "headers", "nowrap"],
    th: ["colspan", "rowspan", "width", "scope", "headers"],
    col: ["span", "width"],
    colgroup: ["span", "width"],
    ol: ["start", "type", "reversed"],
    ul: ["type"],
    li: ["value"],
    time: ["datetime"],
    font: ["color", "size", "face"],
    details: ["open"],
    blockquote: ["cite"],
    q: ["cite"],
    del: ["datetime", "cite"],
    ins: ["datetime", "cite"],
  },
  allowedStyles: { "*": Object.fromEntries(CSS_PROPS.map((p) => [p, [SAFE_CSS_VALUE]])) },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"], source: ["https"], video: ["https"], audio: ["https"], track: ["https"], iframe: ["https"] },
  allowedSchemesAppliedToAttributes: ["href", "src", "cite", "poster", "srcset"],
  allowProtocolRelative: false,
  // Embeds only from these sites.
  allowedIframeHostnames: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "www.google.com", "maps.google.com"],
  allowIframeRelativeUrls: false,
  transformTags: {
    // External links open in a new tab and don't pass ranking signals by default.
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      if (!/^https?:\/\//i.test(href)) return { tagName, attribs };
      const rel = new Set([...(attribs.rel ?? "").split(/\s+/).filter(Boolean), "noopener", "nofollow"]);
      return { tagName, attribs: { ...attribs, target: "_blank", rel: [...rel].join(" ") } };
    },
    iframe: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: attribs.loading ?? "lazy" } }),
  },
  exclusiveFilter: (frame) =>
    // Truly empty paragraphs the editor leaves behind ("<p><br></p>").
    (frame.tag === "p" && !frame.text.trim() && !frame.mediaChildren?.length) ||
    // Images / embeds whose address was removed as unsafe would show as empty boxes.
    (["img", "iframe", "video", "source"].includes(frame.tag) && !frame.attribs.src && !frame.attribs.srcset),
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

/** True when the content has no visible text or media (e.g. an empty editor gives "<p><br></p>"). */
export function isEmptyHtml(html: string | null | undefined): boolean {
  return !html || (!/<(img|iframe|video|audio|table|hr)\b/i.test(html) && !html.replace(/<[^>]*>/g, "").replace(/&nbsp;| /g, " ").trim());
}
