"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, Notice, sendJson } from "./api";
import { RichEditor } from "./RichEditor";

type Row = { slug: string; title: string; published: boolean; publishedAt: string; updatedAt: string };
type Form = {
  originalSlug: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  html: string;
  published: boolean;
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const today = () => new Date().toISOString().slice(0, 10);
const blank = (): Form => ({ originalSlug: "", title: "", slug: "", excerpt: "", coverImage: "", html: "", published: false, publishedAt: today(), seoTitle: "", seoDescription: "" });

/** Blog posts: list, create, edit, publish/unpublish, delete. Posts appear at /blog/<slug>. */
export function BlogManager() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setRows((await getJson<{ posts: Row[] }>("/api/admin/posts")).posts);
    } catch (e) {
      setMsg({ kind: "error", text: `Could not load posts: ${(e as Error).message}` });
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load once on open
    void load();
  }, [load]);

  const startNew = () => {
    setForm(blank());
    setSlugTouched(false);
    setEditorKey((k) => k + 1);
    setMsg(null);
  };
  const edit = async (slug: string) => {
    try {
      const { post } = await getJson<{ post: Form & { seoTitle?: string; seoDescription?: string } }>(`/api/admin/posts?slug=${encodeURIComponent(slug)}`);
      setForm({ ...blank(), ...post, seoTitle: post.seoTitle ?? "", seoDescription: post.seoDescription ?? "", originalSlug: slug });
      setSlugTouched(true);
      setEditorKey((k) => k + 1);
      setMsg(null);
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendJson<{ slug: string }>("/api/admin/posts", "POST", form);
      set({ originalSlug: r.slug, slug: r.slug });
      setMsg({ kind: "ok", text: form.published ? `Saved and published at /blog/${r.slug}.` : `Saved as a draft (not visible on the site).` });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const remove = async (slug: string) => {
    if (!window.confirm(`Delete the post /blog/${slug}? This can't be undone.`)) return;
    try {
      await sendJson("/api/admin/posts?slug=" + encodeURIComponent(slug), "DELETE");
      if (form?.originalSlug === slug) setForm(null);
      setMsg({ kind: "ok", text: "Post deleted." });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Blog</h2>
        <button type="button" onClick={startNew} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">
          + New post
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">Posts appear at /blog. Drafts stay hidden until you tick “Published”.</p>

      {rows && rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="price-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th className="hidden sm:table-cell">Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug}>
                  <td>
                    <span className="font-semibold">{r.title}</span>
                    <span className="block text-xs text-muted">/blog/{r.slug}</span>
                  </td>
                  <td>{r.published ? <span className="text-green-700">Published</span> : <span className="text-muted">Draft</span>}</td>
                  <td className="hidden sm:table-cell">{r.publishedAt}</td>
                  <td className="whitespace-nowrap text-right">
                    <button type="button" onClick={() => edit(r.slug)} className="mr-3 text-sm font-semibold text-link hover:underline">
                      Edit
                    </button>
                    {r.published && (
                      <a href={`/blog/${r.slug}`} target="_blank" rel="noopener" className="mr-3 text-sm text-link hover:underline">
                        View ↗
                      </a>
                    )}
                    <button type="button" onClick={() => remove(r.slug)} className="text-sm text-red-700 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows && rows.length === 0 && !form && <p className="mt-4 rounded-lg bg-tile px-4 py-6 text-sm text-muted">No posts yet. Press “New post” to write the first one.</p>}

      {form && (
        <div className="mt-6 space-y-3 border-t border-line pt-5">
          <h3 className="font-bold">{form.originalSlug ? "Edit post" : "New post"}</h3>
          <label className="block text-sm font-semibold">
            Title
            <input
              value={form.title}
              onChange={(e) => set({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            URL: /blog/
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
          <label className="block text-sm font-semibold">
            Excerpt <span className="font-normal text-muted">(shown in the blog list)</span>
            <textarea value={form.excerpt} onChange={(e) => set({ excerpt: e.target.value })} rows={2} maxLength={400} className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold">
            Cover image <span className="font-normal text-muted">(ImageKit path like /blog/cover.jpg, or an https:// address; optional)</span>
            <input value={form.coverImage} onChange={(e) => set({ coverImage: e.target.value })} className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal" />
          </label>
          <div className="text-sm font-semibold">Post</div>
          <RichEditor key={editorKey} value={form.html} images minHeight={320} onChange={(v) => set({ html: v })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              SEO title <span className="font-normal text-muted">(optional)</span>
              <input value={form.seoTitle} onChange={(e) => set({ seoTitle: e.target.value })} maxLength={120} className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal" />
            </label>
            <label className="block text-sm font-semibold">
              Publish date
              <input type="date" value={form.publishedAt} onChange={(e) => set({ publishedAt: e.target.value })} className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal" />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            SEO description <span className="font-normal text-muted">(optional)</span>
            <textarea value={form.seoDescription} onChange={(e) => set({ seoDescription: e.target.value })} rows={2} maxLength={320} className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal" />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.published} onChange={(e) => set({ published: e.target.checked })} />
            Published (visible on the site)
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !form.title.trim()} onClick={save} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {busy ? "Saving…" : "Save post"}
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">
              Close
            </button>
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
