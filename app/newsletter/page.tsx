import type { Metadata } from "next";
import Link from "next/link";
import NewsletterForm from "@/components/NewsletterForm";

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
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsletterSchema) }}
      />

      {/* Hero */}
      <section className="relative flex min-h-[40vh] items-center justify-center bg-primary">
        <div className="absolute inset-0 bg-gradient-to-br from-black to-gray-900" />
        <div className="relative z-10 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">
            Jacob In Austin
          </p>
          <h1 className="mt-4 text-3xl font-bold uppercase tracking-widest text-white md:text-4xl lg:text-5xl">
            Downtown Austin
            <br />
            Newsletter
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-gray-300">
            Sent every other Tuesday, the Downtown Austin Newsletter is a
            60-second read with data-driven insights, market updates, local
            headlines, off-market opportunities, and a photo.
          </p>
        </div>
      </section>

      {/* Signup Form */}
      <section className="section-padding bg-white">
        <div className="container-narrow max-w-lg">
          <NewsletterForm />
        </div>
      </section>

      {/* Past Newsletters */}
      <section className="section-padding bg-light">
        <div className="container-narrow max-w-lg text-center">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Past Newsletters
          </h2>
          <p className="mt-4 text-secondary">
            Catch up on market insights, local headlines, and off-market
            opportunities from previous editions.
          </p>
          <Link
            href="/insights"
            className="mt-6 inline-block border border-primary px-8 py-3 text-sm uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Browse Insights
          </Link>
        </div>
      </section>
    </>
  );
}
