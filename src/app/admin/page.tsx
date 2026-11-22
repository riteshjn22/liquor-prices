import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";
import { CATEGORIES } from "@/lib/categories";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Protected by HTTP Basic auth in src/proxy.ts (ADMIN_USER / ADMIN_PASSWORD).
export default function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold text-navy">Admin</h1>
      <p className="mt-2 text-muted">
        Switch brands on or off, and manage brands and state prices with Excel. Delhi prices update automatically every day.
      </p>
      <div className="mt-6">
        <AdminPanel categories={CATEGORIES.map((c) => ({ slug: c.slug, name: c.name }))} />
      </div>
    </div>
  );
}
