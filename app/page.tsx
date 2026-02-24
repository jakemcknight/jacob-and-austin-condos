import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Jacob In Austin | Downtown Austin High-Rise Expert",
  description:
    "Find your dream condo in downtown Austin. Jacob Hannusch provides data-driven insight and exclusive resources for buying, selling, or leasing across the city's skyline.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Jacob In Austin | Downtown Austin High-Rise Expert",
    description:
      "Find your dream condo in downtown Austin. Data-driven insight and exclusive resources ensure that every buy, sell, or lease is guided with purpose.",
    type: "website",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1280,
        height: 720,
        alt: "Downtown Austin skyline",
      },
    ],
  },
};

const landingSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Jacob In Austin | Downtown Austin High-Rise Expert",
  description:
    "Find your dream condo in downtown Austin with Jacob Hannusch — your downtown high-rise expert.",
  url: "https://jacobinaustin.com",
  mainEntity: {
    "@type": "RealEstateAgent",
    name: "Jacob Hannusch",
    alternateName: "Jacob In Austin",
    telephone: "+15127181600",
    email: "jacob@jacobinaustin.com",
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingSchema) }}
      />

      {/* Hero */}
      <section className="px-6 pb-12 pt-16 md:px-12 md:pb-16 md:pt-20 lg:px-20">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="text-3xl font-bold uppercase tracking-wider text-primary sm:text-4xl md:text-5xl lg:text-6xl">
            High-Rise Living, Made Simple
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-secondary">
            Find your dream condo in downtown Austin. Data-driven insight and
            exclusive resources ensure that every buy, sell, or lease across the
            city&apos;s skyline is guided with purpose.
          </p>
          <a
            href="#contact"
            className="mt-8 inline-block bg-primary px-8 py-3 text-sm uppercase tracking-widest text-white transition-opacity hover:opacity-80"
          >
            Get in Touch
          </a>
        </div>
      </section>

      {/* Image Gallery */}
      <section className="px-6 pb-16 md:px-12 lg:px-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
          <div className="relative aspect-[3/4]">
            <Image
              src="/images/jacob-headshot.jpg"
              alt="Jacob Hannusch — Downtown Austin high-rise condo expert"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </div>
          <div className="relative aspect-[3/4] overflow-hidden">
            <Image
              src="/images/buildings/the-independent.jpg"
              alt="Downtown Austin high-rise living"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="section-padding bg-white">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-primary md:text-3xl">
            Get Downtown Austin Insights in Your Inbox
          </h2>
          <p className="mt-4 text-lg text-secondary/70">
            A quick 60-second read every other Tuesday with market data, local
            headlines, and off-market opportunities.
          </p>
          <Link
            href="/newsletter"
            className="mt-8 inline-block bg-denim px-8 py-3 text-sm uppercase tracking-widest text-white transition-opacity hover:opacity-80"
          >
            Subscribe
          </Link>
        </div>
      </section>

      {/* Contact */}
      <section id="contact">
        <ContactForm variant="landing" />
      </section>
    </>
  );
}
