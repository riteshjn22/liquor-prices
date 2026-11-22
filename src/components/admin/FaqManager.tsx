"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getJson, Notice, sendJson } from "./api";

type PageOption = { page: string; label: string; url: string; group: "Pages" | "Brands" | "Blog posts" };
type Item = { q: string; a: string };

/** Choose any page and manage its FAQs (shown at the bottom of that page, with FAQ structured data). */
export function FaqManager({ fixedPages }: { fixedPages: { page: string; label: string; url: string }[] }) {
  const [options, setOptions] = useState<PageOption[]>(fixedPages.map((p) => ({ ...p, group: "Pages" })));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const loadLists = useCallback(async () => {
    try {
      const [b, p, c] = await Promise.all([
        getJson<{ brands: { key: string; name: string; category: string; enabled: boolean }[] }>("/api/admin/brands"),
        getJson<{ posts: { slug: string; title: string }[] }>("/api/admin/posts"),
        getJson<{ counts: Record<string, number> }>("/api/admin/faqs"),
      ]);
      setOptions([
        ...fixedPages.map((x) => ({ ...x, group: "Pages" as const })),
        ...b.brands.filter((x) => x.enabled).map((x) => ({ page: `brand:${x.key}`, label: `${x.name} (${x.category})`, url: `/prices/${x.key}`, group: "Brands" as const })),
        ...p.posts.map((x) => ({ page: `post:${x.slug}`, label: x.title, url: `/blog/${x.slug}`, group: "Blog posts" as const })),
      ]);
      setCounts(c.counts);
    } catch (e) {
      setMsg({ kind: "error", text: `Could not load pages: ${(e as Error).message}` });
    }
  }, [fixedPages]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load once on open
    void loadLists();
  }, [loadLists]);

  const choose = async (p: string) => {
    if (dirty && !window.confirm("Discard your unsaved FAQ changes?")) return;
    setPage(p);
    setMsg(null);
    setDirty(false);
    if (!p) return setItems([]);
    try {
      const r = await getJson<{ items: Item[] }>(`/api/admin/faqs?page=${encodeURIComponent(p)}`);
      setItems(r.items.length ? r.items : [{ q: "", a: "" }]);
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  const edit = (i: number, patch: Partial<Item>) => {
    setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    setDirty(true);
  };
  const remove = (i: number) => {
    setItems(items.filter((_, j) => j !== i));
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendJson<{ saved: number }>("/api/admin/faqs", "POST", { page, items });
      setDirty(false);
      setMsg({ kind: "ok", text: r.saved ? `Saved ${r.saved} FAQ${r.saved === 1 ? "" : "s"}. The page is updated.` : "All FAQs removed from this page." });
      setCounts({ ...counts, [page]: r.saved });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const shown = useMemo(() => {
    const w = filter.toLowerCase().trim();
    return options.filter((o) => !w || o.label.toLowerCase().includes(w) || o.page.includes(w));
  }, [options, filter]);
  const groups = (["Pages", "Brands", "Blog posts"] as const).map((g) => ({ g, list: shown.filter((o) => o.group === g) })).filter((x) => x.list.length);
  const current = options.find((o) => o.page === page);

  return (
    <section className="card">
      <h2 className="text-lg font-bold">FAQs</h2>
      <p className="mt-1 text-sm text-muted">Choose a page, then add its questions and answers. Pages without FAQs show no FAQ section.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter pages, e.g. old monk" className="w-56 rounded-lg border border-line px-3 py-2 text-sm" />
        <select value={page} onChange={(e) => choose(e.target.value)} className="min-w-72 rounded-lg border border-line px-2 py-2 text-sm" aria-label="Page">
          <option value="">Choose a page…</option>
          {groups.map(({ g, list }) => (
            <optgroup key={g} label={g}>
              {list.map((o) => (
                <option key={o.page} value={o.page}>
                  {o.label}
                  {counts[o.page] ? ` (${counts[o.page]})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {current && (
          <a href={current.url} target="_blank" rel="noopener" className="pb-2 text-sm text-link hover:underline">
            View page ↗
          </a>
        )}
      </div>

      {page && (
        <div className="mt-4 space-y-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-xl border border-line bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted">FAQ {i + 1}</span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded px-2 py-0.5 text-sm hover:bg-tile disabled:opacity-30" aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded px-2 py-0.5 text-sm hover:bg-tile disabled:opacity-30" aria-label="Move down">
                    ↓
                  </button>
                  <button type="button" onClick={() => remove(i)} className="rounded px-2 py-0.5 text-sm text-red-700 hover:bg-red-50" aria-label="Delete">
                    Delete
                  </button>
                </span>
              </div>
              <input value={it.q} onChange={(e) => edit(i, { q: e.target.value })} placeholder="Question" maxLength={300} className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold" />
              <textarea value={it.a} onChange={(e) => edit(i, { a: e.target.value })} placeholder="Answer" maxLength={3000} rows={3} className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm" />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setItems([...items, { q: "", a: "" }]);
                setDirty(true);
              }}
              className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold"
            >
              + Add FAQ
            </button>
            <button type="button" disabled={busy || !dirty} onClick={save} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {busy ? "Saving…" : "Save FAQs"}
            </button>
            {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
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
