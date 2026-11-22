import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryChips, categoryMap, PostCards } from "@/components/BlogBlocks";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { PageSkeleton } from "@/components/PageSkeleton";
import { SITE_URL } from "@/lib/config";
import { getBlogCategories, getPublishedPosts } from "@/lib/data";

// Crawlers always get complete HTML; new categories render on first visit, then are cached.
export const ensureStatic = "navigation";

const PLACEHOLDER = "__none__";

export async function generateStaticParams() {
  const cats = await getBlogCategories();
  return cats.length ? cats.map((c) => ({ slug: c.slug })) : [{ slug: PLACEHOLDER }];
}

type Props = PageProps<"/blog/category/[slug]">;

async function load(params: Props["params"]) {
  const { slug } = await params;
  if (slug === PLACEHOLDER) return null;
  const categories = await getBlogCategories();
  const category = categories.find((c) => c.slug === slug);
  return category ? { category, categories } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const { category } = data;
  return {
    title: `${category.name}: Blog`,
    description: category.description || `Articles on ${category.name.toLowerCase()} from the blog: liquor prices, excise rules and updates in India.`,
    alternates: { canonical: `/blog/category/${category.slug}` },
    // A category without posts is an empty page: keep it out of search until it has some.
    robots: category.postCount ? undefined : { index: false, follow: true },
  };
}

export default function BlogCategoryPage({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CategoryContent params={params} />
    </Suspense>
  );
}

async function CategoryContent({ params }: Pick<Props, "params">) {
  const data = await load(params);
  if (!data) notFound();
  const { category, categories } = data;
  const posts = await getPublishedPosts(200, category.slug);

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: "Blog", href: "/blog" },
          { name: category.name, href: `/blog/category/${category.slug}` },
        ]}
      />
      <h1 className="mt-5 text-[clamp(27px,4vw,40px)] font-extrabold leading-tight text-navy">{category.name}</h1>
      {category.description && <p className="mt-2 max-w-3xl text-muted">{category.description}</p>}
      <CategoryChips categories={categories} active={category.slug} />

      {posts.length === 0 ? <p className="card mt-6 text-muted">No posts in this category yet. Check back soon.</p> : <PostCards posts={posts} categories={categoryMap(categories)} />}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: category.name,
          url: `${SITE_URL}/blog/category/${category.slug}`,
          ...(category.description ? { description: category.description } : {}),
          hasPart: posts.slice(0, 20).map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE_URL}/blog/${p.slug}`, datePublished: p.publishedAt })),
        }}
      />
    </div>
  );
}
