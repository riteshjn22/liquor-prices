import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";
import { STATES } from "@/lib/config";

export const metadata: Metadata = {
  title: "Admin: Excel import / export",
  robots: { index: false, follow: false },
};

// Protected by HTTP Basic auth in src/proxy.ts (ADMIN_USER / ADMIN_PASSWORD).
export default function AdminPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold text-slate-900">Edit data with Excel</h1>
      <p className="mt-2 text-slate-600">
        Download the price list, change names, descriptions, SEO text, images or prices in Excel, then upload it here.
        Your edits are kept when the daily sync brings in new official prices.
      </p>
      <div className="mt-6">
        <AdminPanel states={STATES.map((s) => ({ slug: s.slug, name: s.name }))} />
      </div>
    </div>
  );
}
