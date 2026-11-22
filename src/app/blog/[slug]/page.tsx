import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Faq } from "@/components/Blocks";
import { Pill } from "@/components/BlogBlocks";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { PageSkeleton } from "@/components/PageSkeleton";
import { RichText } from "@/components/RichText";
import { SITE_NAME, SITE_URL } from "@/lib/config";
import { coverUrl } from "@/lib/cover";
import { getBlogCategories, getFaqs, getPost, getPublishedPosts } from "@/lib/data";
import { formatDate } from "@/lib/format";

// Crawlers always get complete HTML; new posts render on first visit, then are cached.
export const ensureStatic = "navigation";

const PLACEHOLDER = "__none__";

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.length ? posts.map((p) => ({ slug: p.slug })) : [{ slug: PLACEHOLDER }];
}

type Props = PageProps<"/blog/[slug]">;

async function load(params: Props["params"]) {
  const { slug } = await params;
  return slug === PLACEHOLDER ? null : getPost(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await load(params);
  if (!post) return {};
  const title = post.seoTitle || post.title;
  const img = coverUrl(post.coverImage, 1200, 630);
  return {
    title,
    description: post.seoDescription || post.excerpt || undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title, url: `/blog/${post.slug}`, publishedTime: post.publishedAt, images: img ? [{ url: img, width: 1200, height: 630 }] : undefined },
  };
}

export default function BlogPostPage({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PostContent params={params} />
    </Suspense>
  );
}

async function PostContent({ params }: Pick<Props, "params">) {
  const post = await load(params);
  if (!post) notFound();
  const [faqs, recent, categories, sameCategory] = await Promise.all([
    getFaqs(`post:${post.slug}`),
    getPublishedPosts(4),
    getBlogCategories(),
    post.category ? getPublishedPosts(4, post.category) : Promise.resolve([]),
  ]);
  const category = post.category ? categories.find((c) => c.slug === post.category) : undefined;
  // Posts from the same category first, then the newest others.
  const more = [...sameCategory, ...recent].filter((p, i, all) => p.slug !== post.slug && all.findIndex((x) => x.slug === p.slug) === i).slice(0, 3);
  const img = coverUrl(post.coverImage, 1200, 630);

  return (
    <article className="mx-auto max-w-3xl">
      <Breadcrumbs
        items={[
          { name: "Blog", href: "/blog" },
          ...(category ? [{ name: category.name, href: `/blog/category/${category.slug}` }] : []),
          { name: post.title, href: `/blog/${post.slug}` },
        ]}
      />
      <h1 className="mt-5 text-[clamp(27px,4vw,40px)] font-extrabold leading-tight text-navy">{post.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {category && (
          <Link href={`/blog/category/${category.slug}`}>
            <Pill color={category.color}>{category.name}</Pill>
          </Link>
        )}
        <time dateTime={post.publishedAt} className="text-sm text-muted">
          {formatDate(post.publishedAt)}
        </time>
      </div>
      {img && (
        // eslint-disable-next-line @next/next/no-img-element -- ImageKit resizes; skip Vercel's optimiser quota
        <img src={img} alt="" width={1200} height={630} fetchPriority="high" className="mt-5 aspect-video w-full rounded-2xl object-cover" />
      )}
      <RichText html={post.html} className="mt-6" />
      <Faq items={faqs} />

      {more.length > 0 && (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="text-xl font-bold">More from the blog</h2>
          <ul className="mt-3 space-y-2">
            {more.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="font-semibold text-link hover:underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          url: `${SITE_URL}/blog/${post.slug}`,
          ...(img ? { image: img } : {}),
          ...(post.excerpt ? { description: post.excerpt } : {}),
          ...(category ? { articleSection: category.name } : {}),
          publisher: { "@type": "Organization", name: SITE_NAME },
        }}
      />
    </article>
  );
}
