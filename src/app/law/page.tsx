import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/Blocks";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { RichText } from "@/components/RichText";
import { getFaqs, getPageContent } from "@/lib/data";
import { absoluteUrl, htmlToText, LANGUAGE, LOGO_URL, ORG_ID, pageMetadata, webPageLd, wordCount } from "@/lib/seo";

const DEFAULT_TITLE = "Liquor Laws in India";
const DEFAULT_DESCRIPTION = "Liquor laws and rules in India: drinking age, dry days, buying and carrying limits, and state excise rules.";
const lawDescription = (html?: string) => htmlToText(html, 160) || DEFAULT_DESCRIPTION;

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPageContent("law:body");
  const title = content?.title || DEFAULT_TITLE;
  return pageMetadata({
    title,
    description: lawDescription(content?.html),
    path: "/law",
    type: content ? "article" : "website",
    modifiedTime: content?.updatedAt,
    // Keep the page out of search results until real content is written.
    noindex: !content,
  });
}

/** Content is written in the admin (Pages → Law page) or the Excel "Page content" sheet. */
export default async function LawPage() {
  const [content, faqs] = await Promise.all([getPageContent("law:body"), getFaqs("law")]);
  const title = content?.title || DEFAULT_TITLE;
  return (
    <article className="mx-auto max-w-3xl">
      <Breadcrumbs items={[{ name: "Laws", href: "/law" }]} />
      <h1 className="mt-5 text-[clamp(27px,4vw,40px)] font-extrabold leading-tight text-navy">{title}</h1>
      {content ? (
        <RichText html={content.html} className="mt-5" />
      ) : (
        <div className="note mt-5">
          <strong>Coming soon:</strong> we are preparing a guide to liquor laws and rules in India. Meanwhile, browse{" "}
          <Link href="/prices" className="font-semibold underline">
            liquor prices
          </Link>
          .
        </div>
      )}
      <Faq items={faqs} />

      {content && (
        <JsonLd
          data={webPageLd({
            path: "/law",
            name: title,
            description: lawDescription(content.html),
            dateModified: content.updatedAt,
            hasBreadcrumb: true,
            mainEntity: {
              "@type": "Article",
              "@id": `${absoluteUrl("/law")}#article`,
              headline: title.slice(0, 110),
              description: lawDescription(content.html),
              dateModified: content.updatedAt,
              inLanguage: LANGUAGE,
              wordCount: wordCount(content.html),
              author: { "@id": ORG_ID },
              publisher: { "@id": ORG_ID },
              image: LOGO_URL,
              mainEntityOfPage: { "@id": `${absoluteUrl("/law")}#webpage` },
            },
          })}
        />
      )}
    </article>
  );
}
