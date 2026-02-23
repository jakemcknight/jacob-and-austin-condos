import AllListings from "@/components/AllListings";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Downtown Austin Condos For Sale | All Active Listings | Jacob In Austin",
  description: "Browse all active condos for sale in downtown Austin. Filter by building, bedrooms, price, and more. View listings from 37+ luxury high-rise buildings with real-time MLS data.",
  keywords: ["downtown austin condos", "condos for sale austin", "austin high rise condos", "luxury condos austin", "downtown austin real estate"],
  alternates: {
    canonical: "/for-sale",
  },
  openGraph: {
    title: "Downtown Austin Condos For Sale | Jacob In Austin",
    description: "Browse all active condos for sale in downtown Austin. Real-time MLS data from 37+ luxury buildings.",
    type: "website",
    images: ["/images/og-default.jpg"],
  },
};

export default function ForSalePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative flex min-h-[50vh] items-center justify-center bg-gradient-to-br from-primary to-denim">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-300">
            Downtown Austin Real Estate
          </p>
          <h1 className="mt-4 text-4xl font-bold uppercase tracking-widest text-white md:text-5xl">
            Condos For Sale
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-200">
            Browse all active condo listings across 37+ downtown Austin buildings.
            Filter by building, bedrooms, price range, and more to find your perfect home.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-300">
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Real-time MLS data
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Updated hourly
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Direct listing details
            </span>
          </div>
        </div>
      </section>

      {/* All Listings Component */}
      <AllListings />

      {/* Footer CTA */}
      <section className="border-t border-gray-100 bg-white px-6 py-12 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-2xl font-bold text-primary md:text-3xl">
            Looking for something specific?
          </h2>
          <p className="mb-6 text-lg text-secondary">
            Let me help you find the perfect condo in downtown Austin. I have access to all
            listings, including off-market opportunities.
          </p>
          <a
            href="/#inquiry"
            className="inline-block border border-primary bg-primary px-8 py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-primary"
          >
            Contact Jacob
          </a>
        </div>
      </section>

      {/* Back Link */}
      <section className="border-t border-gray-100 bg-light px-6 py-6 text-center">
        <a
          href="/downtown-condos"
          className="text-sm uppercase tracking-wider text-accent transition-colors hover:text-primary"
        >
          ← Back to All Buildings
        </a>
      </section>
    </>
  );
}
