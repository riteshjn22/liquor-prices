"use client";

import { useState } from "react";
import { PILL_COLORS } from "@/lib/blog";
import type { PillColor } from "@/lib/types";
import { Notice, sendJson } from "./api";

export type CategoryRow = { slug: string; name: string; description: string; color: PillColor; order: number; postCount: number };
type Form = { originalSlug: string; name: string; slug: string; description: string; color: PillColor };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function CategoryPill({ color, children }: { color: PillColor; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${PILL_COLORS[color]?.className ?? PILL_COLORS.gray.className}`}>{children}</span>;
}

/** Blog categories: add, rename, recolour, reorder, delete. Lists live at /blog/category/<slug>. */
export function BlogCategories({ categories, onChanged }: { categories: CategoryRow[] | null; onChanged: () => Promise<void> }) {
  const [form, setForm] = useState<Form | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendJson<{ slug: string }>("/api/admin/blog-categories", "POST", form);
      setForm(null);
      setMsg({ kind: "ok", text: `Saved. Its posts are listed at /blog/category/${r.slug}.` });
      await onChanged();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: CategoryRow) => {
    const note = c.postCount ? ` Its ${c.postCount} post${c.postCount === 1 ? "" : "s"} will stay, without a category.` : "";
    if (!window.confirm(`Delete the category “${c.name}”?${note}`)) return;
    try {
      await sendJson("/api/admin/blog-categories?slug=" + encodeURIComponent(c.slug), "DELETE");
      if (form?.originalSlug === c.slug) setForm(null);
      setMsg({ kind: "ok", text: "Category deleted." });
      await onChanged();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!categories) return;
    const list = [...categories];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    try {
      // Renumber every row 1, 2, 3… so positions never collide.
      await Promise.all(list.map((c, k) => (c.order === k + 1 ? null : sendJson("/api/admin/blog-categories", "POST", { ...c, originalSlug: c.slug, order: k + 1 }))));
      await onChanged();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  return (
    <div className="rounded-xl border border-line bg-page p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">Categories</h3>
        <button
          type="button"
          onClick={() => {
            setForm({ originalSlug: "", name: "", slug: "", description: "", color: "blue" });
            setSlugTouched(false);
            setMsg(null);
          }}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold"
        >
          + New category
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">The label colour shows on the home page “Latest Updates” and on blog lists.</p>

      {categories && categories.length === 0 && !form && <p className="mt-3 text-sm text-muted">No categories yet, for example “Dry Days”, “Excise Policy”, “Price Update”, “Awareness”.</p>}
      {categories && categories.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
          {categories.map((c, i) => (
            <li key={c.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <CategoryPill color={c.color}>{c.name}</CategoryPill>
              <span className="text-xs text-muted">
                /blog/category/{c.slug} · {c.postCount} post{c.postCount === 1 ? "" : "s"}
              </span>
              <span className="ml-auto flex items-center gap-3 whitespace-nowrap">
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="text-muted disabled:opacity-30">
                  ↑
                </button>
                <button type="button" aria-label="Move down" disabled={i === categories.length - 1} onClick={() => move(i, 1)} className="text-muted disabled:opacity-30">
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ originalSlug: c.slug, name: c.name, slug: c.slug, description: c.description, color: c.color });
                    setSlugTouched(true);
                    setMsg(null);
                  }}
                  className="font-semibold text-link hover:underline"
                >
                  Edit
                </button>
                <a href={`/blog/category/${c.slug}`} target="_blank" rel="noopener" className="text-link hover:underline">
                  View ↗
                </a>
                <button type="button" onClick={() => remove(c)} className="text-red-700 hover:underline">
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div className="mt-3 space-y-3 rounded-lg border border-line bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Name
              <input
                value={form.name}
                onChange={(e) => set({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
                placeholder="Dry Days"
                maxLength={80}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              URL: /blog/category/
              <input
                value={form.slug}
                onChange={(e) => {
                  set({ slug: e.target.value });
                  setSlugTouched(true);
                }}
                onBlur={() => set({ slug: slugify(form.slug) })}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal"
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Description <span className="font-normal text-muted">(shown on the category page and used for search results; optional)</span>
            <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={400} className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal" />
          </label>
          <fieldset>
            <legend className="text-sm font-semibold">Label colour</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {(Object.keys(PILL_COLORS) as PillColor[]).map((k) => (
                <label key={k} className={`cursor-pointer rounded-full p-0.5 ring-2 ${form.color === k ? "ring-navy" : "ring-transparent"}`}>
                  <input type="radio" name="cat-color" value={k} checked={form.color === k} onChange={() => set({ color: k })} className="sr-only" />
                  <CategoryPill color={k}>{form.name || PILL_COLORS[k].label}</CategoryPill>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <button type="button" disabled={busy || !form.name.trim()} onClick={save} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {busy ? "Saving…" : "Save category"}
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg && (
        <div className="mt-3">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
    </div>
  );
}
