import type { Metadata } from "next";
import { Faq } from "@/components/Blocks";
import { CategoryChips, categoryMap, PostCards } from "@/components/BlogBlocks";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/config";
import { getBlogCategories, getFaqs, getPublishedPosts } from "@/lib/data";
import { BLOG_ID, LANGUAGE, ORG_ID, latestDate, pageMetadata, webPageLd } from "@/lib/seo";

const TITLE = "Blog: Liquor Prices, Laws & Guides";
const DESCRIPTION = "Articles about liquor prices, dry days, excise rules and brands in India.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/blog" });

/** Posts are written in the admin (Blog tab). */
export default async function BlogIndex() {
  const [posts, categories, faqs] = await Promise.all([getPublishedPosts(), getBlogCategories(), getFaqs("blog")]);
  const cats = categoryMap(categories);
  return (
    <div>
      <Breadcrumbs items={[{ name: "Blog", href: "/blog" }]} />
      <h1 className="mt-5 text-[clamp(27px,4vw,40px)] font-extrabold leading-tight text-navy">Blog</h1>
      <p className="mt-2 max-w-3xl text-muted">Guides and updates on liquor prices, excise rules and brands in India.</p>
      <CategoryChips categories={categories} />

      {posts.length === 0 ? <p className="card mt-6 text-muted">No posts yet. Check back soon.</p> : <PostCards posts={posts} categories={cats} />}
      <Faq items={faqs} />

      <JsonLd
        data={webPageLd({
          type: "CollectionPage",
          path: "/blog",
          name: TITLE,
          description: DESCRIPTION,
          dateModified: latestDate(posts.map((p) => p.updatedAt)),
          hasBreadcrumb: true,
          mainEntity: {
            "@type": "Blog",
            "@id": BLOG_ID,
            name: `${SITE_NAME} blog`,
            url: `${SITE_URL}/blog`,
            description: DESCRIPTION,
            inLanguage: LANGUAGE,
            publisher: { "@id": ORG_ID },
            blogPost: posts.slice(0, 30).map((p) => ({
              "@type": "BlogPosting",
              "@id": `${SITE_URL}/blog/${p.slug}#article`,
              headline: p.title.slice(0, 110),
              url: `${SITE_URL}/blog/${p.slug}`,
              datePublished: p.publishedAt,
              dateModified: p.updatedAt,
              ...(p.category && cats.get(p.category) ? { articleSection: cats.get(p.category)!.name } : {}),
            })),
          },
        })}
      />
    </div>
  );
}
