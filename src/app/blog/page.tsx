import type { Metadata } from "next";
import { Faq } from "@/components/Blocks";
import { CategoryChips, categoryMap, PostCards } from "@/components/BlogBlocks";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBlogCategories, getFaqs, getPublishedPosts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Blog: Liquor Prices, Laws & Guides",
  description: "Articles about liquor prices, excise rules and brands in India.",
  alternates: { canonical: "/blog" },
};

/** Posts are written in the admin (Blog tab). */
export default async function BlogIndex() {
  const [posts, categories, faqs] = await Promise.all([getPublishedPosts(), getBlogCategories(), getFaqs("blog")]);
  return (
    <div>
      <Breadcrumbs items={[{ name: "Blog", href: "/blog" }]} />
      <h1 className="mt-5 text-[clamp(27px,4vw,40px)] font-extrabold leading-tight text-navy">Blog</h1>
      <p className="mt-2 max-w-3xl text-muted">Guides and updates on liquor prices, excise rules and brands in India.</p>
      <CategoryChips categories={categories} />

      {posts.length === 0 ? <p className="card mt-6 text-muted">No posts yet. Check back soon.</p> : <PostCards posts={posts} categories={categoryMap(categories)} />}
      <Faq items={faqs} />
    </div>
  );
}
