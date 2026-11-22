import type { ReactNode } from "react";

/** Small fetch helpers for the admin screens. The browser re-sends the admin login automatically. */
export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export async function sendJson<T>(url: string, method: "POST" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export function Notice({ kind, children }: { kind: "ok" | "error"; children: ReactNode }) {
  return <p className={`rounded-md px-3 py-2 text-sm ${kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{children}</p>;
}
