"use client";

import { useEffect, useState } from "react";
import { getJson, Notice, sendJson } from "./api";
import { RichEditor } from "./RichEditor";

/** The content block shown above "<Brand> Price State-wise" on a brand page. */
export function BrandContentEditor({ brandKey, onClose }: { brandKey: string; onClose: () => void }) {
  const [brand, setBrand] = useState<{ key: string; name: string; description: string } | null>(null);
  const [html, setHtml] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    getJson<{ brand: { key: string; name: string; description: string } }>(`/api/admin/brands?key=${encodeURIComponent(brandKey)}`)
      .then((r) => {
        if (!alive) return;
        setBrand(r.brand);
        setHtml(r.brand.description);
      })
      .catch((e) => alive && setMsg({ kind: "error", text: (e as Error).message }));
    return () => {
      alive = false;
    };
  }, [brandKey]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await sendJson("/api/admin/brands", "POST", { keys: [brandKey], description: html });
      setDirty(false);
      setMsg({ kind: "ok", text: html ? "Saved. The brand page is updated." : "Content removed from the brand page." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    onClose();
  };

  return (
    <div className="mt-4 rounded-xl border-2 border-navy/20 bg-[#fbfcfe] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">Content for {brand?.name ?? brandKey}</h3>
        <span className="flex gap-3 text-sm">
          <a href={`/prices/${brandKey}`} target="_blank" rel="noopener" className="text-link hover:underline">
            View page ↗
          </a>
          <button type="button" onClick={close} className="text-muted hover:text-ink">
            Close ✕
          </button>
        </span>
      </div>
      <p className="mt-1 mb-3 text-xs text-muted">Shown on the brand page above the state-wise price table. Same as the “Description” column in the Excel Brands sheet.</p>
      {brand ? (
        <RichEditor
          key={brand.key}
          value={brand.description}
          images
          onChange={(v) => {
            setHtml(v);
            setDirty(true);
          }}
        />
      ) : (
        !msg && <p className="text-sm text-muted">Loading…</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !dirty} onClick={save} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? "Saving…" : "Save content"}
        </button>
        {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
      </div>
      {msg && (
        <div className="mt-3">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
    </div>
  );
}
