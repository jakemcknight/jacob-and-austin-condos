import type { Metadata } from "next";
import { getAllInsights } from "@/lib/blog/mdx";
import InsightsGrid from "@/components/InsightsGrid";
import NewsletterForm from "@/components/NewsletterForm";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Downtown Austin market insights, newsletters, and analysis from Jacob Hannusch — your downtown high-rise expert. Market data, local headlines, and off-market opportunities.",
  alternates: { canonical: "/insights" },
  openGraph: {
    title: "Insights | Jacob In Austin",
    description:
      "Downtown Austin market insights, newsletters, and analysis. Market data, local headlines, and off-market opportunities.",
    type: "website",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1280,
        height: 720,
        alt: "Jacob In Austin Insights",
      },
    ],
  },
};

const insightsSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Insights | Jacob In Austin",
  description:
    "Downtown Austin market insights, newsletters, and analysis from Jacob Hannusch.",
  url: "https://jacobinaustin.com/insights",
};

export default function InsightsPage() {
  const posts = getAllInsights();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(insightsSchema) }}
      />

      {/* Hero */}
      <section className="section-padding bg-white">
        <div className="container-narrow max-w-3xl text-center">
          <h1 className="text-3xl font-bold uppercase tracking-widest text-primary md:text-4xl">
            Insights
          </h1>
          <p className="mt-4 text-lg text-secondary">
            Downtown Austin market insights, newsletters, and analysis —
            delivered every other Tuesday.
          </p>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="bg-light px-6 py-8 md:px-12">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm font-medium text-secondary">
            Get insights in your inbox every other Tuesday
          </p>
          <div className="mt-4">
            <NewsletterForm compact />
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="section-padding bg-light">
        <div className="container-narrow">
          {posts.length === 0 ? (
            <p className="py-12 text-center text-secondary">
              Insights coming soon. Subscribe above to be notified!
            </p>
          ) : (
            <InsightsGrid posts={posts} />
          )}
        </div>
      </section>
    </>
  );
}
