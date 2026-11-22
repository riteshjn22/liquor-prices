"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, Notice, sendJson } from "./api";
import { RichEditor } from "./RichEditor";

type Slot = { key: string; label: string; url: string; hasTitle?: boolean; fallback: string; title: string; html: string; updatedAt: string | null };

/** Edit page sections: /prices About, each category's About, the law page. */
export function PagesManager() {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setSlots((await getJson<{ slots: Slot[] }>("/api/admin/content")).slots);
    } catch (e) {
      setMsg({ kind: "error", text: `Could not load pages: ${(e as Error).message}` });
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load once on open
    void load();
  }, [load]);

  const open = (s: Slot) => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setActive(s.key);
    setHtml(s.html);
    setTitle(s.title);
    setDirty(false);
    setMsg(null);
  };

  const save = async (clear = false) => {
    if (!active) return;
    setBusy(true);
    setMsg(null);
    try {
      await sendJson("/api/admin/content", "POST", { key: active, html: clear ? "" : html, title: clear ? "" : title });
      setDirty(false);
      if (clear) {
        setHtml("");
        setTitle("");
      }
      setMsg({ kind: "ok", text: clear ? "Cleared. The page now uses its default." : "Saved. The page is updated." });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const current = slots?.find((s) => s.key === active);

  return (
    <section className="card">
      <h2 className="text-lg font-bold">Page content</h2>
      <p className="mt-1 text-sm text-muted">Write the About sections and the law page. You can also edit these in the Excel “Page content” sheet.</p>
      {!slots && !msg && <p className="mt-4 text-sm text-muted">Loading…</p>}
      {slots && (
        <div className="mt-4 grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
          <ul className="space-y-1">
            {slots.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => open(s)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${active === s.key ? "border-navy bg-navy text-white" : "border-line bg-white hover:border-link"}`}
                >
                  <span className="block font-semibold">{s.label}</span>
                  <span className={`text-xs ${active === s.key ? "text-slate-200" : s.html ? "text-green-700" : "text-muted"}`}>{s.html ? "✓ Written" : "Using default"}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0">
            {!current ? (
              <p className="rounded-lg bg-tile px-4 py-6 text-sm text-muted">Choose a section on the left to edit it.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-bold">{current.label}</h3>
                  <a href={current.url} target="_blank" rel="noopener" className="text-sm text-link hover:underline">
                    View page ↗
                  </a>
                </div>
                <p className="text-xs text-muted">When empty: {current.fallback}</p>
                {current.hasTitle && (
                  <label className="block text-sm font-semibold">
                    Page heading
                    <input
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setDirty(true);
                      }}
                      placeholder="Liquor Laws in India"
                      className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal"
                    />
                  </label>
                )}
                <RichEditor
                  key={current.key}
                  value={current.html}
                  images
                  onChange={(v) => {
                    setHtml(v);
                    setDirty(true);
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={busy || !dirty} onClick={() => save(false)} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                    {busy ? "Saving…" : "Save"}
                  </button>
                  {current.html && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => window.confirm("Remove this text? The page goes back to its default.") && save(true)}
                      className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
                    >
                      Clear
                    </button>
                  )}
                  {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {msg && (
        <div className="mt-3">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
    </section>
  );
}
