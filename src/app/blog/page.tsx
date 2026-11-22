import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/Blocks";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { coverUrl } from "@/lib/cover";
import { getFaqs, getPublishedPosts } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Blog: Liquor Prices, Laws & Guides",
  description: "Articles about liquor prices, excise rules and brands in India.",
  alternates: { canonical: "/blog" },
};

/** Posts are written in the admin (Blog tab). */
export default async function BlogIndex() {
  const [posts, faqs] = await Promise.all([getPublishedPosts(), getFaqs("blog")]);
  return (
    <div>
      <Breadcrumbs items={[{ name: "Blog", href: "/blog" }]} />
      <h1 className="mt-5 text-[clamp(27px,4vw,40px)] font-extrabold leading-tight text-navy">Blog</h1>
      <p className="mt-2 max-w-3xl text-muted">Guides and updates on liquor prices, excise rules and brands in India.</p>

      {posts.length === 0 ? (
        <p className="card mt-6 text-muted">No posts yet. Check back soon.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => {
            const img = coverUrl(p.coverImage, 640, 360);
            return (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="card card-hover block h-full overflow-hidden !p-0">
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element -- ImageKit resizes; skip Vercel's optimiser quota
                    <img src={img} alt="" width={640} height={360} loading="lazy" className="aspect-video w-full object-cover" />
                  )}
                  <div className="p-4">
                    <time dateTime={p.publishedAt} className="text-xs text-muted">
                      {formatDate(p.publishedAt)}
                    </time>
                    <h2 className="mt-1 text-lg font-bold leading-snug text-ink">{p.title}</h2>
                    {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted">{p.excerpt}</p>}
                    <span className="mt-3 inline-block text-sm font-bold text-link">Read more ›</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Faq items={faqs} />
    </div>
  );
}
