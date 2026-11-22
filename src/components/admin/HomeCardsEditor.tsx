"use client";

import { useCallback, useEffect, useState } from "react";
import type { HomeCard } from "@/lib/types";
import { getJson, Notice, sendJson } from "./api";

/** Edit the home page "Explore Information" cards: title, short text and where each one links. */
export function HomeCardsEditor() {
  const [cards, setCards] = useState<HomeCard[] | null>(null);
  const [defaults, setDefaults] = useState<HomeCard[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getJson<{ cards: HomeCard[]; defaults: HomeCard[] }>("/api/admin/home");
      setCards(r.cards);
      setDefaults(r.defaults);
    } catch (e) {
      setMsg({ kind: "error", text: `Could not load the home cards: ${(e as Error).message}` });
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load once on open
    void load();
  }, [load]);

  const update = (id: string, patch: Partial<HomeCard>) => {
    setCards((list) => list?.map((c) => (c.id === id ? { ...c, ...patch } : c)) ?? null);
    setDirty(true);
  };

  const save = async () => {
    if (!cards) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendJson<{ cards: HomeCard[] }>("/api/admin/home", "POST", { cards });
      setCards(r.cards);
      setDirty(false);
      setMsg({ kind: "ok", text: "Saved. The home page is updated." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Home page: Explore Information cards</h2>
        <a href="/" target="_blank" rel="noopener" className="text-sm text-link hover:underline">
          View home page ↗
        </a>
      </div>
      <p className="mt-1 text-sm text-muted">
        Links can be a page on this site (for example <code>/blog/category/dry-days</code> or <code>/blog/dry-days-in-delhi-2026</code>) or a full https:// address.
      </p>
      {!cards && !msg && <p className="mt-4 text-sm text-muted">Loading…</p>}
      {cards && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {cards.map((c) => {
            const d = defaults.find((x) => x.id === c.id);
            return (
              <fieldset key={c.id} className="space-y-2 rounded-xl border border-line p-3">
                <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted">{d?.title ?? c.id}</legend>
                <label className="block text-sm font-semibold">
                  Title
                  <input value={c.title} maxLength={60} onChange={(e) => update(c.id, { title: e.target.value })} className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal" />
                </label>
                <label className="block text-sm font-semibold">
                  Short text
                  <input value={c.subtitle} maxLength={100} onChange={(e) => update(c.id, { subtitle: e.target.value })} className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal" />
                </label>
                <label className="block text-sm font-semibold">
                  Link
                  <input value={c.href} maxLength={500} onChange={(e) => update(c.id, { href: e.target.value })} placeholder={d?.href} className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal" />
                </label>
              </fieldset>
            );
          })}
        </div>
      )}
      {cards && (
        <div className="mt-3 flex items-center gap-2">
          <button type="button" disabled={busy || !dirty} onClick={save} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? "Saving…" : "Save cards"}
          </button>
          {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
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
