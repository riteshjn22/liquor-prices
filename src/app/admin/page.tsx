import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";
import { CATEGORIES } from "@/lib/categories";
import { fixedFaqPages } from "@/lib/pages";

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
        Brands, page content, FAQs, blog posts and Excel import/export. Delhi prices are not fetched automatically; they change only when you run a sync.
      </p>
      <div className="mt-6">
        <AdminPanel categories={CATEGORIES.map((c) => ({ slug: c.slug, name: c.name }))} faqPages={fixedFaqPages()} />
      </div>
    </div>
  );
}
