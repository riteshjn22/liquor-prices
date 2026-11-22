import Link from "next/link";
import { PILL_COLORS } from "@/lib/blog";
import { coverUrl } from "@/lib/cover";
import type { BlogCategoryWithCount, PostSummary } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { BlogCategory, PillColor } from "@/lib/types";

export function Pill({ color, children, className = "" }: { color: PillColor; children: React.ReactNode; className?: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold leading-none ${PILL_COLORS[color]?.className ?? PILL_COLORS.gray.className} ${className}`}>{children}</span>;
}

/** slug -> category, for labelling post lists. */
export function categoryMap(categories: BlogCategory[]): Map<string, BlogCategory> {
  return new Map(categories.map((c) => [c.slug, c]));
}

/** Grid of post cards (blog list and category pages). */
export function PostCards({ posts, categories }: { posts: PostSummary[]; categories: Map<string, BlogCategory> }) {
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => {
        const img = coverUrl(p.coverImage, 640, 360);
        const cat = p.category ? categories.get(p.category) : undefined;
        return (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="card card-hover block h-full overflow-hidden !p-0">
              {img && (
                // eslint-disable-next-line @next/next/no-img-element -- ImageKit resizes; skip Vercel's optimiser quota
                <img src={img} alt="" width={640} height={360} loading="lazy" className="aspect-video w-full object-cover" />
              )}
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {cat && <Pill color={cat.color}>{cat.name}</Pill>}
                  <time dateTime={p.publishedAt} className="text-xs text-muted">
                    {formatDate(p.publishedAt)}
                  </time>
                </div>
                <h2 className="mt-2 text-lg font-bold leading-snug text-ink">{p.title}</h2>
                {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted">{p.excerpt}</p>}
                <span className="mt-3 inline-block text-sm font-bold text-link">Read more ›</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** "All" + one chip per category that has posts. */
export function CategoryChips({ categories, active }: { categories: BlogCategoryWithCount[]; active?: string }) {
  const shown = categories.filter((c) => c.postCount > 0 || c.slug === active);
  if (!shown.length) return null;
  const base = "rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1";
  return (
    <nav aria-label="Blog categories" className="mt-5 flex flex-wrap gap-2">
      <Link href="/blog" className={`${base} ${!active ? "bg-navy text-white ring-navy" : "bg-white text-ink ring-line hover:ring-link"}`}>
        All
      </Link>
      {shown.map((c) => (
        <Link
          key={c.slug}
          href={`/blog/category/${c.slug}`}
          aria-current={c.slug === active ? "page" : undefined}
          className={`${base} ${c.slug === active ? "bg-navy text-white ring-navy" : "bg-white text-ink ring-line hover:ring-link"}`}
        >
          {c.name} <span className={c.slug === active ? "text-slate-300" : "text-muted"}>{c.postCount}</span>
        </Link>
      ))}
    </nav>
  );
}
