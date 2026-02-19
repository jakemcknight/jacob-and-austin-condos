import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, getAllTags } from "@/lib/blog/mdx";

export const metadata: Metadata = {
  title: "Blog | Downtown Austin Condos | Jacob In Austin",
  description:
    "Expert insights on downtown Austin condos, market trends, buying guides, and neighborhood information from Jacob Hannusch.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Blog | Downtown Austin Condos | Jacob In Austin",
    description:
      "Expert insights on downtown Austin condos, market trends, and buying guides.",
    type: "website",
    images: ["/images/og-default.jpg"],
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const tags = getAllTags();

  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[40vh] items-center justify-center bg-gradient-to-br from-primary to-denim">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-300">
            Insights & Guides
          </p>
          <h1 className="mt-4 text-4xl font-bold uppercase tracking-widest text-white md:text-5xl">
            Blog
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-200">
            Expert insights on downtown Austin high-rise condos, market trends,
            buying guides, and neighborhood information.
          </p>
        </div>
      </section>

      {/* Tags */}
      {tags.length > 0 && (
        <section className="border-b bg-white px-6 py-4">
          <div className="mx-auto flex max-w-4xl flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-gray-200 px-3 py-1 text-xs uppercase tracking-wider text-gray-500"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Posts */}
      <section className="mx-auto max-w-4xl px-6 py-12">
        {posts.length === 0 ? (
          <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-accent">
              Coming Soon
            </p>
            <p className="mt-4 text-lg text-secondary">
              Blog posts are on the way. Check back soon for expert insights on
              downtown Austin condos.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="rounded border border-gray-200 bg-white p-6 transition hover:shadow-md"
              >
                <div className="flex flex-wrap gap-2">
                  {post.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-accent/10 px-2 py-0.5 text-xs uppercase tracking-wider text-accent"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link href={`/blog/${post.slug}`}>
                  <h2 className="mt-3 text-xl font-bold text-primary hover:text-accent">
                    {post.title}
                  </h2>
                </Link>
                <p className="mt-2 text-secondary">{post.description}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                  <span>{new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  <span>·</span>
                  <span>{post.readingTime} min read</span>
                  <span>·</span>
                  <span>{post.author}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
