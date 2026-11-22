"use client";

import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";

/**
 * Admin rich-text editor (TipTap). Produces HTML; the server sanitizes it on save.
 * Remount with a different `key` to load another item.
 */
export function RichEditor({ value, onChange, minHeight = 220, images = false }: { value: string; onChange: (html: string) => void; minHeight?: number; images?: boolean }) {
  const [source, setSource] = useState(false);
  const [html, setHtml] = useState(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, code: false, codeBlock: false, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      ...(images ? [Image.configure({ inline: false })] : []),
    ],
    content: value,
    immediatelyRender: false, // avoid a server/client mismatch in Next.js
    shouldRerenderOnTransaction: true, // keep toolbar active states current
    editorProps: { attributes: { class: "rich px-4 py-3 outline-none", style: `min-height:${minHeight}px` } },
    onUpdate: ({ editor: e }) => {
      const out = e.isEmpty ? "" : e.getHTML();
      setHtml(out);
      onChange(out);
    },
  });

  if (!editor) return <div className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted" style={{ minHeight }}>Loading editor…</div>;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white focus-within:border-link">
      <Toolbar
        editor={editor}
        images={images}
        source={source}
        onToggleSource={() => {
          if (source) editor.commands.setContent(html, { emitUpdate: true });
          setSource(!source);
        }}
      />
      {source ? (
        <textarea
          value={html}
          onChange={(e) => {
            setHtml(e.target.value);
            onChange(e.target.value);
          }}
          spellCheck={false}
          className="block w-full px-4 py-3 font-mono text-xs outline-none"
          style={{ minHeight }}
          aria-label="HTML source"
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}

function Btn({ on, label, title, onClick, disabled }: { on?: boolean; label: string; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      className={`min-w-8 rounded px-2 py-1 text-sm font-semibold disabled:opacity-30 ${on ? "bg-navy text-white" : "text-ink hover:bg-tile"}`}
    >
      {label}
    </button>
  );
}

function Toolbar({ editor, images, source, onToggleSource }: { editor: Editor; images: boolean; source: boolean; onToggleSource: () => void }) {
  const c = () => editor.chain().focus();
  const setLink = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "https://";
    const url = window.prompt("Link address (https://… or /prices/rum/old-monk). Leave empty to remove the link.", prev);
    if (url === null) return;
    if (!url.trim()) c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };
  const addImage = () => {
    const url = window.prompt("Image address (https://…, e.g. an ImageKit URL)", "https://");
    if (url && /^https:\/\//.test(url.trim())) c().setImage({ src: url.trim() }).run();
  };
  const off = source;
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-tile/60 px-2 py-1.5">
      <Btn label="P" title="Paragraph" on={editor.isActive("paragraph")} disabled={off} onClick={() => c().setParagraph().run()} />
      <Btn label="H2" title="Heading" on={editor.isActive("heading", { level: 2 })} disabled={off} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <Btn label="H3" title="Sub-heading" on={editor.isActive("heading", { level: 3 })} disabled={off} onClick={() => c().toggleHeading({ level: 3 }).run()} />
      <span className="mx-1 h-5 w-px bg-line" />
      <Btn label="B" title="Bold" on={editor.isActive("bold")} disabled={off} onClick={() => c().toggleBold().run()} />
      <Btn label="I" title="Italic" on={editor.isActive("italic")} disabled={off} onClick={() => c().toggleItalic().run()} />
      <Btn label="U" title="Underline" on={editor.isActive("underline")} disabled={off} onClick={() => c().toggleUnderline().run()} />
      <span className="mx-1 h-5 w-px bg-line" />
      <Btn label="• List" title="Bullet list" on={editor.isActive("bulletList")} disabled={off} onClick={() => c().toggleBulletList().run()} />
      <Btn label="1. List" title="Numbered list" on={editor.isActive("orderedList")} disabled={off} onClick={() => c().toggleOrderedList().run()} />
      <Btn label="❝" title="Quote" on={editor.isActive("blockquote")} disabled={off} onClick={() => c().toggleBlockquote().run()} />
      <Btn label="Link" title="Add or edit a link" on={editor.isActive("link")} disabled={off} onClick={setLink} />
      {images && <Btn label="Image" title="Insert an image" disabled={off} onClick={addImage} />}
      <span className="mx-1 h-5 w-px bg-line" />
      <Btn label="↶" title="Undo" disabled={off || !editor.can().undo()} onClick={() => c().undo().run()} />
      <Btn label="↷" title="Redo" disabled={off || !editor.can().redo()} onClick={() => c().redo().run()} />
      <span className="ml-auto" />
      <Btn label={source ? "Visual" : "HTML"} title={source ? "Back to the visual editor" : "Edit the HTML source"} on={source} onClick={onToggleSource} />
    </div>
  );
}
