import { Suspense } from "react";
import type { Metadata } from "next";
import DataDashboard from "@/components/DataDashboard";

export const metadata: Metadata = {
  title: "Downtown Austin Condo Market Data | Jacob In Austin",
  description:
    "Explore downtown Austin condo market analytics — pricing trends, building comparisons, year-over-year performance, and appreciation data across 37+ buildings.",
  alternates: {
    canonical: "/downtown-condos/data",
  },
  openGraph: {
    title: "Downtown Austin Condo Market Data | Jacob In Austin",
    description:
      "Interactive market analytics for downtown Austin condos. Pricing trends, building comparisons, and more.",
    type: "website",
    images: ["/images/og-default.jpg"],
  },
};

export default function DataPage() {
  return (
    <Suspense
      fallback={
        <section className="flex min-h-screen items-center justify-center bg-light">
          <p className="text-sm uppercase tracking-wider text-secondary">
            Loading market data...
          </p>
        </section>
      }
    >
      <DataDashboard />
    </Suspense>
  );
}
