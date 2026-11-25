"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, Notice, sendJson } from "./api";

/** One switch for the whole site: visible to search engines (index) or hidden (noindex). */
export function SearchVisibility() {
  const [indexable, setIndexable] = useState<boolean | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getJson<{ indexable: boolean; updatedAt: string | null }>("/api/admin/visibility");
      setIndexable(r.indexable);
      setUpdatedAt(r.updatedAt);
    } catch (e) {
      setMsg({ kind: "error", text: `Could not load the setting: ${(e as Error).message}` });
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load once on open
    void load();
  }, [load]);

  const change = async (next: boolean) => {
    const question = next
      ? "Allow search engines to index the whole site? Pages can then appear in Google."
      : "Hide the whole site from search engines? Every page gets a noindex tag and the sitemap is emptied. Pages already in Google drop out over the next days or weeks.";
    if (!window.confirm(question)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendJson<{ indexable: boolean; updatedAt: string }>("/api/admin/visibility", "POST", { indexable: next });
      setIndexable(r.indexable);
      setUpdatedAt(r.updatedAt);
      setMsg({ kind: "ok", text: r.indexable ? "Saved. The site is open to search engines." : "Saved. The whole site is now noindex." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Search engines</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Hide the whole site while you test it (for example on the vercel.app address), and open it when you are ready for Google.
          </p>
        </div>
        {indexable !== null && (
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${indexable ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
            {indexable ? "● Visible: index" : "● Hidden: noindex"}
          </span>
        )}
      </div>

      {indexable === null && !msg && <p className="mt-3 text-sm text-muted">Loading…</p>}
      {indexable !== null && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Search engine visibility">
          {[
            { value: true, title: "Index (visible)", text: "Pages can appear in Google and other search engines. The sitemap lists every page." },
            { value: false, title: "Noindex (hidden)", text: "Every page says noindex, nofollow. The sitemap is empty. The site still works for visitors with the link." },
          ].map((o) => {
            const active = indexable === o.value;
            return (
              <button
                key={String(o.value)}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy || active}
                onClick={() => change(o.value)}
                className={`rounded-xl border-2 p-3 text-left text-sm disabled:cursor-default ${active ? (o.value ? "border-green-600 bg-green-50" : "border-red-500 bg-red-50") : "border-line bg-white hover:border-link"}`}
              >
                <span className="block font-bold text-ink">
                  {active ? "◉" : "○"} {o.title}
                </span>
                <span className="mt-1 block text-muted">{o.text}</span>
              </button>
            );
          })}
        </div>
      )}
      {updatedAt && <p className="mt-2 text-xs text-muted">Last changed {new Date(updatedAt).toLocaleString("en-IN")}</p>}
      {msg && (
        <div className="mt-3">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
    </section>
  );
}
