import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandCards, CategoryTiles, Faq, SectionTitle } from "@/components/Blocks";
import { categoryMap, Pill } from "@/components/BlogBlocks";
import { JsonLd } from "@/components/JsonLd";
import { CATEGORIES } from "@/lib/categories";
import { SITE_NAME, SITE_URL } from "@/lib/config";
import { coverUrl } from "@/lib/cover";
import { pageMetadata, webPageLd } from "@/lib/seo";
import { getBlogCategories, getCategorySummaries, getFaqs, getHomeCards, getPopularBrands, getPublishedPosts, type PostSummary } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { BlogCategory, HomeCard } from "@/lib/types";

const HOME_TITLE = `${SITE_NAME} | Liquor Prices, Laws & Dry Day Updates in India`;
const HOME_DESCRIPTION =
  "India's liquor information portal: brand-wise prices for whisky, beer, wine, vodka, rum and brandy by state and bottle size, plus dry days, excise rules and the latest updates.";

export const metadata: Metadata = pageMetadata({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/", ownImageFile: true });

/** Icons for the "Explore Information" cards, by card id. */
const ICONS: Record<string, ReactNode> = {
  "dry-days": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 9h18M7 13h2m3 0h2m3 0h2M7 17h2m3 0h2" />
    </svg>
  ),
  laws: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M5 6h14M7 6l-4 8h8L7 6Zm10 0-4 8h8l-4-8ZM7 21h10" />
    </svg>
  ),
  prices: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12M6 8.5h12M9.5 4c3 0 5 1.8 5 4.5S12.5 13 9.5 13H7l8 7" />
    </svg>
  ),
  awareness: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s8-7.2 8-12a8 8 0 0 0-16 0c0 4.8 8 12 8 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
};

function InfoCard({ card }: { card: HomeCard }) {
  const external = /^https?:\/\//.test(card.href);
  const body = (
    <>
      <span className="block h-[30px] w-[30px] shrink-0 text-navy sm:h-[38px] sm:w-[38px]" aria-hidden>
        {ICONS[card.id]}
      </span>
      <span className="mt-2 block sm:mt-0">
        <strong className="block text-[16px] text-ink sm:text-[19px]">{card.title}</strong>
        {card.subtitle && <small className="mt-1 block text-[13px] text-muted sm:text-[15px]">{card.subtitle}</small>}
      </span>
    </>
  );
  const cls = "card-hover block min-h-[105px] rounded-[18px] bg-tile px-3.5 py-4 sm:flex sm:items-center sm:gap-[18px] sm:px-5 sm:py-[18px]";
  return external ? (
    <a href={card.href} target="_blank" rel="noopener" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={card.href} className={cls}>
      {body}
    </Link>
  );
}

function UpdateRow({ post, category }: { post: PostSummary; category?: BlogCategory }) {
  const img = coverUrl(post.coverImage, 300, 190);
  return (
    <li>
      <Link href={`/blog/${post.slug}`} className="group grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 px-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:gap-4">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageKit resizes; skip Vercel's optimiser quota
          <img src={img} alt="" width={150} height={95} loading="lazy" className="h-[76px] w-[88px] rounded-[13px] object-cover sm:h-[95px] sm:w-[150px]" />
        ) : (
          <span aria-hidden className="grid h-[76px] w-[88px] place-items-center rounded-[13px] bg-tile text-3xl sm:h-[95px] sm:w-[150px]">
            📰
          </span>
        )}
        <span className="min-w-0">
          {category && <Pill color={category.color}>{category.name}</Pill>}
          <span className="mt-1.5 line-clamp-2 block text-[15px] font-bold leading-snug text-ink group-hover:text-link sm:text-[17px]">{post.title}</span>
          <span className="mt-1 block text-xs text-[#64748b] sm:text-[13px]">Updated: {formatDate(post.updatedAt)}</span>
        </span>
        <span aria-hidden className="text-2xl text-ink">
          ›
        </span>
      </Link>
    </li>
  );
}

export default async function HomePage() {
  const [cards, categories, popular, posts, blogCategories, faqs] = await Promise.all([
    getHomeCards(),
    getCategorySummaries(),
    getPopularBrands(12),
    getPublishedPosts(3),
    getBlogCategories(),
    getFaqs("home"),
  ]);
  const cats = categoryMap(blogCategories);

  return (
    <div>
      <section className="text-center">
        <h1 className="text-[clamp(25px,3.3vw,36px)] font-extrabold tracking-tight text-ink">India&apos;s Liquor Information Portal</h1>
        <p className="mx-auto mt-2 max-w-2xl text-[15px] text-[#475569] sm:text-[17px]">Liquor Prices, Dry Days, Excise Rules &amp; State-wise Information</p>
      </section>

      <section className="mt-7 border-b border-line pb-6">
        <SectionTitle title="Explore Information" />
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {cards.map((c) => (
            <InfoCard key={c.id} card={c} />
          ))}
        </div>
      </section>

      <section className="mt-6 border-b border-line pb-6">
        <SectionTitle title="Explore Liquor Categories" href="/prices" linkText="View All Categories" />
        <CategoryTiles categories={categories} showCount={false} />
      </section>

      {popular.length > 0 && (
        <section className="mt-6 border-b border-line pb-6">
          <SectionTitle title="Popular Brands" />
          <BrandCards brands={popular} />
        </section>
      )}

      <section className="mt-6">
        <SectionTitle title="Latest Updates" href="/blog" linkText="View All Updates" />
        <p className="mb-3 leading-snug text-muted">Latest excise notifications, dry-day announcements and price revisions.</p>
        {posts.length === 0 ? (
          <p className="rounded-xl bg-tile px-4 py-6 text-sm text-muted">No updates yet. New articles will appear here.</p>
        ) : (
          <ul className="divide-y divide-line">
            {posts.map((p) => (
              <UpdateRow key={p.slug} post={p} category={p.category ? cats.get(p.category) : undefined} />
            ))}
          </ul>
        )}
      </section>

      <Faq items={faqs} />

      <JsonLd
        data={webPageLd({
          path: "/",
          name: HOME_TITLE,
          description: HOME_DESCRIPTION,
          dateModified: posts[0]?.updatedAt,
          mainEntity: {
            "@type": "ItemList",
            name: "Liquor price categories",
            itemListElement: CATEGORIES.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: `${c.name} prices`, url: `${SITE_URL}/prices/${c.slug}` })),
          },
        })}
      />
    </div>
  );
}
