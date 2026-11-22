"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

// Jodit needs the browser (window/document), so it is loaded only on the client, only in the admin.
const JoditEditor = dynamic(() => import("jodit-react"), {
  ssr: false,
  loading: () => <div className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">Loading editor…</div>,
});

/**
 * Full HTML editor (Jodit) used everywhere in the admin: brand content, page sections, law page, blog.
 * It keeps whatever HTML you write or paste (tables, divs, classes, styles, embeds…) and has a
 * source view. The server still cleans the HTML on save: scripts, event handlers and unknown
 * iframes are removed (see src/lib/rich-text.ts).
 * Remount with a different `key` to load another item.
 */
export function RichEditor({ value, onChange, minHeight = 260, images = false }: { value: string; onChange: (html: string) => void; minHeight?: number; images?: boolean }) {
  // Jodit owns the text while typing; feeding every change back in would move the cursor.
  const [initial] = useState(value);

  const config = useMemo(
    () => ({
      readonly: false,
      minHeight,
      height: "auto",
      toolbarAdaptive: false,
      toolbarSticky: false,
      placeholder: "Start writing, or switch to source view (<>) to paste HTML…",
      buttons: [
        "source",
        "|",
        "paragraph",
        "fontsize",
        "brush",
        "|",
        "bold",
        "italic",
        "underline",
        "strikethrough",
        "superscript",
        "subscript",
        "eraser",
        "|",
        "ul",
        "ol",
        "indent",
        "outdent",
        "align",
        "|",
        "link",
        ...(images ? ["image", "video"] : []),
        "table",
        "hr",
        "symbols",
        "|",
        "undo",
        "redo",
        "|",
        "fullsize",
        "preview",
      ],
      // Keep pasted HTML as it is (no "keep / clean?" dialog).
      askBeforePasteHTML: false,
      askBeforePasteFromWord: false,
      defaultActionOnPaste: "insert_as_html" as const,
      // Images by address only (ImageKit URLs); no base64 blobs stored in the database.
      uploader: { insertImageAsBase64URI: false },
      // Plain textarea for the source view, and no HTML beautifier: both would otherwise load scripts from a CDN.
      sourceEditor: "area" as const,
      beautifyHTML: false,
      cleanHTML: { removeEmptyElements: false, fillEmptyParagraph: false },
      link: { openInNewTabCheckbox: true, noFollowCheckbox: true },
      showCharsCounter: false,
      showWordsCounter: false,
      showXPathInStatusbar: false,
      disablePlugins: ["speech-recognize", "ai-assistant", "powered-by-jodit", "about"],
    }),
    [minHeight, images],
  );

  return (
    <div className="rich-editor overflow-hidden rounded-xl border border-line bg-white">
      <JoditEditor value={initial} config={config} onChange={(html: string) => onChange(isBlank(html) ? "" : html)} />
    </div>
  );
}

/** An empty Jodit editor still produces markup such as "<p><br></p>". */
function isBlank(html: string): boolean {
  return !/<(img|iframe|video|audio|table|hr)\b/i.test(html) && !html.replace(/<[^>]*>/g, "").replace(/&nbsp;| /g, " ").trim();
}
