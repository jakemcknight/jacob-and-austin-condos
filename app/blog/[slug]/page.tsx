import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPostSlugs, getPostBySlug, getAllPosts } from "@/lib/blog/mdx";

interface BlogPostPageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const post = getPostBySlug(params.slug);
  if (!post) return { title: "Post Not Found" };

  return {
    title: `${post.title} | Jacob In Austin`,
    description: post.description,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    keywords: post.keywords,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: post.image ? [post.image] : ["/images/og-default.jpg"],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: post.image ? [post.image] : ["/images/og-default.jpg"],
    },
  };
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getPostBySlug(params.slug);

  if (!post || post.status !== "published") {
    notFound();
  }

  // Get related posts by shared tags
  const allPosts = getAllPosts();
  const relatedPosts = allPosts
    .filter(
      (p) =>
        p.slug !== post.slug &&
        p.tags.some((t) => post.tags.includes(t))
    )
    .slice(0, 3);

  // JSON-LD structured data
  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
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
      "@id": `https://jacobinaustin.com/downtown-condos/blog/${post.slug}`,
    },
    image: post.image
      ? `https://jacobinaustin.com/downtown-condos${post.image}`
      : "https://jacobinaustin.com/downtown-condos/images/og-default.jpg",
    wordCount: post.content.split(/\s+/).length,
    keywords: post.keywords.join(", "),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://jacobinaustin.com/downtown-condos",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://jacobinaustin.com/downtown-condos/blog",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `https://jacobinaustin.com/downtown-condos/blog/${post.slug}`,
      },
    ],
  };

  return (
    <>
      {/* Breadcrumbs */}
      <div className="border-b bg-white px-6 py-3">
        <div className="mx-auto max-w-3xl">
          <nav className="text-xs text-gray-400" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-accent">
              Home
            </Link>
            <span className="mx-2">›</span>
            <Link href="/blog" className="hover:text-accent">
              Blog
            </Link>
            <span className="mx-2">›</span>
            <span className="text-gray-600">{post.title}</span>
          </nav>
        </div>
      </div>

      {/* Article */}
      <article className="mx-auto max-w-3xl px-6 py-12">
        {/* Header */}
        <header className="mb-10">
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-accent/10 px-2 py-0.5 text-xs uppercase tracking-wider text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-primary md:text-4xl">
            {post.title}
          </h1>
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
            <span>
              {new Date(post.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span>·</span>
            <span>{post.readingTime} min read</span>
            <span>·</span>
            <span>By {post.author}</span>
          </div>
        </header>

        {/* MDX Content */}
        <div className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-primary prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-img:rounded">
          <MDXRemote source={post.content} />
        </div>

        {/* CTA */}
        <div className="mt-12 rounded border border-gray-200 bg-gray-50 p-8 text-center">
          <h3 className="text-lg font-bold text-primary">
            Looking for a downtown Austin condo?
          </h3>
          <p className="mt-2 text-secondary">
            I can help you find the perfect high-rise home. Let&apos;s chat.
          </p>
          <Link
            href="/#inquiry"
            className="mt-4 inline-block border border-primary bg-primary px-8 py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-primary"
          >
            Contact Jacob
          </Link>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="border-t bg-gray-50 px-6 py-12">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-accent">
              Related Posts
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp.slug}
                  href={`/blog/${rp.slug}`}
                  className="rounded border border-gray-200 bg-white p-4 transition hover:shadow-md"
                >
                  <p className="text-xs text-gray-400">
                    {new Date(rp.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-primary">
                    {rp.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back Link */}
      <section className="border-t border-gray-100 bg-white px-6 py-6 text-center">
        <Link
          href="/blog"
          className="text-sm uppercase tracking-wider text-accent transition-colors hover:text-primary"
        >
          ← Back to All Posts
        </Link>
      </section>

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogPostingSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
    </>
  );
}
