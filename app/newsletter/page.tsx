import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import NewsletterForm from "@/components/NewsletterForm";
import { getAllInsights } from "@/lib/blog/mdx";

export const metadata: Metadata = {
  title: "Downtown Austin Newsletter",
  description:
    "Subscribe to the Downtown Austin Newsletter — a 60-second read every other Tuesday with market data, local headlines, off-market opportunities, and a photo.",
  alternates: { canonical: "/newsletter" },
  openGraph: {
    title: "Downtown Austin Newsletter | Jacob In Austin",
    description:
      "A 60-second read every other Tuesday with data-driven insights, market updates, local headlines, and off-market opportunities.",
    type: "website",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1280,
        height: 720,
        alt: "Downtown Austin Newsletter",
      },
    ],
  },
};

const newsletterSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Downtown Austin Newsletter",
  description:
    "Subscribe to the Downtown Austin Newsletter by Jacob Hannusch — market data, local headlines, and off-market opportunities.",
  url: "https://jacobinaustin.com/newsletter",
};

export default function NewsletterPage() {
  const recentPosts = getAllInsights().slice(0, 4);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsletterSchema) }}
      />

      {/* Hero */}
      <section className="bg-light px-6 py-16 text-center md:py-20">
        <h1 className="text-3xl font-bold uppercase tracking-widest text-primary md:text-4xl lg:text-5xl">
          Downtown Austin Newsletter
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-secondary">
          Sent every other Tuesday, the Downtown Austin Newsletter is a quick
          60-second read with data-driven insights, market updates, local
          headlines, off-market opportunities, and a photo from my perspective
          around the city.
        </p>
      </section>

      {/* Signup: Skyline Image + Form */}
      <section className="bg-light">
        <div className="mx-auto max-w-6xl px-6 md:grid md:grid-cols-2 md:gap-8 lg:gap-12 lg:px-0">
          {/* Skyline Image — hidden on mobile */}
          <div className="relative hidden min-h-[500px] md:block">
            <Image
              src="/images/downtown-austin-skyline.jpg"
              alt="Downtown Austin skyline"
              fill
              className="object-cover object-top"
              sizes="50vw"
              priority
            />
          </div>

          {/* Form */}
          <div className="flex items-start justify-center bg-[#f0ede6] px-6 py-12 md:px-12 md:py-16">
            <div className="w-full max-w-lg">
              <h2 className="text-2xl font-bold uppercase tracking-wide text-primary md:text-3xl">
                Sign Up Here
              </h2>
              <div className="mt-10">
                <NewsletterForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Newsletters */}
      <section className="section-padding bg-light">
        <div className="container-narrow">
          <div className="text-center">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
              Past Newsletters
            </h2>
            <p className="mt-4 text-secondary">
              Catch up on market insights, local headlines, and off-market
              opportunities from previous editions.
            </p>
          </div>

          {recentPosts.length > 0 && (
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {recentPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/insights/${post.slug}`}
                  className="group block overflow-hidden border border-gray-100 bg-white transition-shadow hover:shadow-lg"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                    {post.thumbnail ? (
                      <Image
                        src={post.thumbnail}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-3xl">
                          {post.category === "newsletter" ? "\u{1F4EC}" : "\u{1F4CA}"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {post.category && (
                      <span className="text-xs font-medium uppercase tracking-wider text-accent">
                        {post.category === "newsletter"
                          ? "Past Newsletter"
                          : "Article"}
                      </span>
                    )}
                    <h3 className="mt-2 text-lg font-semibold text-primary transition-colors group-hover:text-accent">
                      {post.title}
                    </h3>
                    <div className="mt-3 flex items-center gap-3 text-xs text-accent">
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
                </Link>
              ))}
            </div>
          )}

          <div className="mt-10 text-center">
            <Link
              href="/insights"
              className="inline-block border border-primary px-8 py-3 text-sm uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-white"
            >
              View All Newsletters
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
