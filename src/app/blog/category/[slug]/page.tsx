import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryChips, categoryMap, PostCards } from "@/components/BlogBlocks";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { PageSkeleton } from "@/components/PageSkeleton";
import { SITE_URL } from "@/lib/config";
import { getBlogCategories, getPublishedPosts } from "@/lib/data";
import { BLOG_ID, fullDescription, latestDate, pageMetadata, WEBSITE_ID, webPageLd } from "@/lib/seo";

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
  return pageMetadata({
    title: `${category.name}: Blog`,
    description: describe(category),
    path: `/blog/category/${category.slug}`,
    // A category without posts is an empty page: keep it out of search until it has some.
    noindex: !category.postCount,
  });
}

const describe = (c: { name: string; description: string }) =>
  fullDescription(c.description, `Articles on ${c.name.toLowerCase()} from the blog: liquor prices, excise rules and updates in India.`);

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
        data={webPageLd({
          type: "CollectionPage",
          path: `/blog/category/${category.slug}`,
          name: `${category.name}: Blog`,
          description: describe(category),
          dateModified: latestDate(posts.map((p) => p.updatedAt)),
          hasBreadcrumb: true,
          extra: { isPartOf: [{ "@id": WEBSITE_ID }, { "@id": BLOG_ID }], about: { "@type": "Thing", name: category.name } },
          mainEntity: {
            "@type": "ItemList",
            name: category.name,
            numberOfItems: posts.length,
            itemListElement: posts.slice(0, 50).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/blog/${p.slug}`, name: p.title })),
          },
        })}
      />
    </div>
  );
}
