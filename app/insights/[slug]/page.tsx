import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import {
  getInsightBySlug,
  getAllInsightSlugs,
} from "@/lib/blog/mdx";
import NewsletterForm from "@/components/NewsletterForm";

// Custom MDX components for consistent typography
const mdxComponents = {
  h1: (props: React.ComponentPropsWithoutRef<"h1">) => (
    <h1
      className="mt-10 mb-4 text-3xl font-bold text-primary"
      {...props}
    />
  ),
  h2: (props: React.ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="mt-10 mb-4 text-2xl font-semibold text-primary"
      {...props}
    />
  ),
  h3: (props: React.ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="mt-8 mb-3 text-xl font-semibold text-primary"
      {...props}
    />
  ),
  p: (props: React.ComponentPropsWithoutRef<"p">) => (
    <p className="mb-4 leading-relaxed text-secondary" {...props} />
  ),
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  img: (props: React.ComponentPropsWithoutRef<"img">) => (
    <img className="my-6 w-full rounded-lg" {...props} />
  ),
  a: (props: React.ComponentPropsWithoutRef<"a">) => (
    <a
      className="text-accent underline decoration-accent/30 underline-offset-2 hover:text-primary hover:decoration-primary"
      {...props}
    />
  ),
  ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="mb-4 list-disc space-y-1 pl-6 text-secondary"
      {...props}
    />
  ),
  ol: (props: React.ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="mb-4 list-decimal space-y-1 pl-6 text-secondary"
      {...props}
    />
  ),
  li: (props: React.ComponentPropsWithoutRef<"li">) => (
    <li className="leading-relaxed" {...props} />
  ),
  blockquote: (props: React.ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="my-6 border-l-4 border-accent pl-4 italic text-secondary"
      {...props}
    />
  ),
  hr: () => <hr className="my-8 border-gray-200" />,
  strong: (props: React.ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-primary" {...props} />
  ),
};

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return getAllInsightSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const post = getInsightBySlug(params.slug);
  if (!post) {
    return { title: "Not Found" };
  }

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/insights/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: post.thumbnail
        ? [{ url: post.thumbnail, width: 1200, height: 630, alt: post.title }]
        : [{ url: "/images/og-default.jpg", width: 1280, height: 720 }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: post.thumbnail ? [post.thumbnail] : ["/images/og-default.jpg"],
    },
  };
}

export default function InsightPage({ params }: PageProps) {
  const post = getInsightBySlug(params.slug);
  if (!post) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      "@type": "Person",
      name: post.author,
      url: "https://jacobinaustin.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Jacob In Austin",
      url: "https://jacobinaustin.com",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://jacobinaustin.com/insights/${post.slug}`,
    },
    ...(post.thumbnail && { image: `https://jacobinaustin.com${post.thumbnail}` }),
    keywords: post.keywords.join(", "),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {/* Article Header */}
      <section className="section-padding bg-white pb-8">
        <div className="container-narrow max-w-3xl">
          {post.category && (
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-accent">
              {post.category === "newsletter" ? "Past Newsletter" : "Article"}
            </p>
          )}
          <h1 className="mt-4 text-3xl font-bold text-primary md:text-4xl">
            {post.title}
          </h1>
          <div className="mt-4 flex items-center gap-3 text-sm text-accent">
            <span>{post.author}</span>
            <span>&middot;</span>
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
            <span>&middot;</span>
            <span>{post.readingTime} min read</span>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <section className="px-6 pb-16 md:px-12 lg:px-20">
        <article className="container-narrow max-w-3xl">
          <MDXRemote source={post.content} components={mdxComponents} />
        </article>
      </section>

      {/* Newsletter CTA */}
      <section className="section-padding bg-white">
        <div className="container-narrow max-w-lg text-center">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Get Insights in Your Inbox
          </h2>
          <p className="mt-4 text-secondary">
            Delivered every other Tuesday — market data, local headlines, and
            off-market opportunities.
          </p>
          <div className="mt-6">
            <NewsletterForm compact />
          </div>
        </div>
      </section>

      {/* Back to Insights */}
      <section className="border-t border-gray-100 bg-light px-6 py-8 text-center">
        <Link
          href="/insights"
          className="text-sm uppercase tracking-wider text-accent transition-colors hover:text-primary"
        >
          &larr; Back to Insights
        </Link>
      </section>
    </>
  );
}
