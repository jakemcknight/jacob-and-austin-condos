import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import NewsletterForm from "@/components/NewsletterForm";

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
      <section className="relative flex min-h-[70vh] items-center justify-center bg-primary">
        <div className="absolute inset-0 bg-gradient-to-br from-black to-gray-900" />
        <div className="relative z-10 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">
            Jacob In Austin
          </p>
          <h1 className="mt-4 text-4xl font-bold uppercase tracking-widest text-white md:text-5xl lg:text-6xl">
            High-Rise Living,
            <br />
            Made Simple
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-300">
            Find your dream condo in downtown Austin. Data-driven insight and
            exclusive resources ensure that every buy, sell, or lease across the
            city&apos;s skyline is guided with purpose.
          </p>
          <a
            href="#contact"
            className="mt-8 inline-block border border-white px-8 py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-primary"
          >
            Get in Touch
          </a>
        </div>
      </section>

      {/* About */}
      <section className="section-padding bg-white">
        <div className="container-narrow">
          <div className="mx-auto grid max-w-4xl items-center gap-12 md:grid-cols-2">
            {/* Headshot */}
            <div className="flex justify-center">
              <div className="relative h-[350px] w-[280px] overflow-hidden md:h-[420px] md:w-[340px]">
                <Image
                  src="/images/jacob-headshot.jpg"
                  alt="Jacob Hannusch — Downtown Austin high-rise condo expert"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 280px, 340px"
                  priority
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
                Your Downtown High-Rise Expert
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-secondary">
                With deep expertise in Austin&apos;s downtown high-rise market,
                Jacob provides data-driven insight and exclusive resources to
                help you buy, sell, or lease in the city&apos;s most
                sought-after buildings.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-secondary">
                From luxury penthouses to modern urban flats, find your perfect
                downtown Austin condo.
              </p>
              <Link
                href="/downtown-condos"
                className="mt-8 inline-block border border-primary px-8 py-3 text-sm uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Explore Downtown Condos
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="section-padding bg-light">
        <div className="container-narrow max-w-xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Get Downtown Austin Insights in Your Inbox
          </h2>
          <p className="mt-4 text-lg text-secondary">
            A quick 60-second read every other Tuesday with market data, local
            headlines, and off-market opportunities.
          </p>
          <div className="mt-8">
            <NewsletterForm compact />
          </div>
          <p className="mt-4 text-xs text-accent">
            <Link href="/insights" className="underline hover:text-primary">
              Browse past newsletters
            </Link>
          </p>
        </div>
      </section>

      {/* Contact */}
      <section id="contact">
        <ContactForm />
      </section>
    </>
  );
}
